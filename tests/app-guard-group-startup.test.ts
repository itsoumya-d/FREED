import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind } from 'typescript';
import { actualAdapter } from './helpers/native-account-adapter-fixture';
import { task86ScopeDependencies } from './helpers/task86-native-account-fixture';
import { createLatestSerialJob } from '../src/lib/latest-serial-job';
import { syncNativeAppGuard, getAppGuardPackages } from '../src/lib/app-guard';
import { buildNativeAppScheduleConfiguration } from '../src/lib/app-schedules';
import { createDefaultRecoveryState, updateDisciplineSettings } from '../src/lib/recovery-state';
import { getJourneyOwner } from '../src/lib/user-journey';
import { createProtectionRefreshCoordinator } from '../src/lib/website-protection-operations';

const requireLocal = createRequire(`${process.cwd()}/package.json`);
const React = requireLocal('react');
const { create, act } = requireLocal('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const source = readFileSync('src/features/freed-app.tsx', 'utf8');
const between = (start: string, end: string) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing Root extraction anchors: ${start} -> ${end}`);
  return source.slice(a, b);
};
const script = between('  const getProtectionActionScope =', '  const knownProtectionScope =') +
  'const knownProtectionScope = getProtectionActionScope();\n' +
  between('  const captureProtectionActionTicket =', '  const appGroups =') +
  between('  const projectGenericProtectionStatus =', '  const refreshProtectionStatus =') +
  between('  const refreshProtectionStatus =', '\n  React.useEffect(') +
  between('  const [appConfigSyncBusy,', '  const earnedAppOrigin =') +
  between('  type AppConfigInput =', '  // Keep the native always-allow list') +
  'return {syncAppProtection,appConfigQueue,refreshProtectionStatus};';
const compile = (code: string) => transpileModule(code, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
const deferred = () => { let resolve!: () => void; return { promise: new Promise<void>(r => { resolve = r; }), resolve: () => resolve() }; };

// Actual Root effect/caller/queue, production app-guard and production bridge.
// Only OS methods and account/storage input are controlled here.
function fixture(options: { platform?: 'ios' | 'android'; appGroups?: boolean; readGate?: ReturnType<typeof deferred>; readFailure?: boolean;
  manualStartup?: boolean; readGates?: ReturnType<typeof deferred>[]; failedReads?: number[] } = {}) {
  const platform = options.platform ?? 'ios', adapter = actualAdapter(platform);
  let owner = 'startup-owner', sdkOwner: string | null = owner, scopeThrows = false;
  let capability: any = { platform, appGroups: options.appGroups ?? true, appGuardModes: true, appSchedules: true, screenTime: true, managedSettings: true };
  let failRead = options.readFailure === true, reads = 0, writes = 0;
  const enteredRead = deferred(), publications: any[] = [], messages: (string | null)[] = [];
  const capabilities: any[] = [], completions: boolean[] = [], nativePublications: any[] = [];
  const coordinator = createProtectionRefreshCoordinator<any>({ capability: null, status: null });
  const status: any = { statusVersion: 2, statusVisibility: 'device', statusReadAccepted: true, authorized: true, active: true,
    mode: platform === 'ios' ? 'screen-time' : 'accessibility', message: 'Observed native protection', adultFilterActive: true, adultFilterRequested: true, adultWebPolicyConfigured: true };
  const read = async () => { const index = reads++; enteredRead.resolve(); const gate = options.readGates?.[index] ?? options.readGate; if (gate) await gate.promise; if (failRead || options.failedReads?.includes(index)) throw Error('controlled native read failure'); return status; };
  adapter.native.getCapabilities = async () => capability;
  adapter.native.getDevicePublicStatus = read; adapter.native.getStatus = read;
  adapter.native.configureBlockedAppPackages = adapter.native.configureAppGuardMode = adapter.native.configureAppSchedules = async () => { writes++; throw Error('obsolete native write'); };
  const ownerLease = { ownerUid: owner, isCurrent: () => owner === 'startup-owner' && sdkOwner === owner };
  const state = createDefaultRecoveryState(), recoveryStateRef = { current: state };
  state.disciplineSettings = { ...state.disciplineSettings, blockedAppPackages: ['com.instagram.android'], dailyLimitMinutes: 75,
    appGuardModeConfiguredAt: '2026-10-18T01:00:00.000Z', strictGuardConfiguredAt: '2026-10-18T01:00:00.000Z', emergencyStrictMode: true, sleepModeEnabled: true };
  const deps: any = { React, createLatestSerialJob, syncNativeAppGuard, getAppGuardPackages, buildNativeAppScheduleConfiguration, updateDisciplineSettings, getJourneyOwner,
    getFirebaseAuthSnapshot: () => { if (scopeThrows) { scopeThrows = false; throw Error('scope unavailable'); } return { status: 'ready', signedIn: true, anonymous: false, ownerUid: owner, email: null }; },
    getFirebaseAccountScope: () => sdkOwner, privateLockedRef: { current: false }, accountFlowFence: { current: { isActive: () => false } },
    accountHostGeneration: { current: 4 }, nativePrivateReadState: { current: { hydrated: true, storageReady: true, ownerLease } },
    appGroupsMemorySuspended: { current: false }, appGroupsSuspensionEpoch: { current: 0 }, protectionHostAlive: { current: true },
    protectionReadback: { current: coordinator },
    setProtectionStatus: (value: any) => { coordinator.publishNative({ ...coordinator.getSnapshot(), status: value }); publications.push(value); nativePublications.push(value); }, setProtectionSyncMessage: (value: string | null) => messages.push(value),
    setProtectionCapability: (value: any) => capabilities.push(value), setProtectionStatusRaw: (value: any) => publications.push(value), setProtectionRefreshCompleted: (value: boolean) => completions.push(value),
    ...task86ScopeDependencies(() => deps.getFirebaseAuthSnapshot(), () => sdkOwner),
    getProtectionCapabilities: adapter.api.getProtectionCapabilities, getProtectionStatus: adapter.api.getProtectionStatus,
    configureBlockedAppPackages: adapter.api.configureBlockedAppPackages, configureAppGuardMode: adapter.api.configureAppGuardMode, configureAppSchedules: adapter.api.configureAppSchedules,
    persistRecoveryState: () => state, recoveryStateRef, hydrated: true, storageReady: true, ownerLease };
  const selectedScript = options.manualStartup ? script.slice(0, script.indexOf('  const appConfigurationKey =')) + 'return {syncAppProtection,appConfigQueue,refreshProtectionStatus};' : script;
  const factory = new Function(...Object.keys(deps), 'protectionCapability', 'disciplineSettings', compile(selectedScript));
  let api: any, view: any;
  const Host = () => { api = factory(...Object.values(deps), capability, state.disciplineSettings); return null; };
  const mount = async () => { await act(async () => { view = create(React.createElement(Host)); }); };
  const drain = async () => { await act(async () => { await api.appConfigQueue.current.whenIdle(); }); };
  return { mount, drain, enteredRead, publications, messages, status, state, deps, capabilities, completions, nativePublications, coordinator, get capability() { return capability; }, get api() { return api; }, get reads() { return reads; }, get writes() { return writes; },
    failRead: (value: boolean) => { failRead = value; }, loseOwner: () => { sdkOwner = null; }, failScope: () => { scopeThrows = true; },
    setGroupCapability: async (value: boolean) => { capability = { ...capability, appGroups: value }; await act(async () => { view.update(React.createElement(Host)); }); },
    dispose: async () => { await act(async () => { view.unmount(); }); } };
}

test('actual group-capable Root startup reads observed status instead of invoking retired settings writers', async () => {
  for (const platform of ['ios', 'android'] as const) {
    const f = fixture({ platform }); try {
      await f.mount(); await f.drain();
      assert.equal(f.reads, 1); assert.equal(f.writes, 0);
      assert.equal(f.publications.length, 1); assert.equal(f.publications[0].statusReadAccepted, true);
      assert.equal(f.publications[0].adultFilterActive, true); assert.equal(f.publications[0].active, true);
      assert.ok(!f.messages.some(message => message?.includes('could not sync')));
      assert.equal(f.state.disciplineSettings.dailyLimitMinutes, 75);
    } finally { await f.dispose(); }
  }
});

test('actual modern status read failure stays visible and retry publishes only a genuine read', async () => {
  const f = fixture({ readFailure: true }); try {
    await f.mount(); await f.drain(); assert.equal(f.publications.length, 0);
    assert.deepEqual(f.capabilities, []); assert.deepEqual(f.completions, []);
    assert.ok(f.messages.some(message => message?.includes('could not sync')));
    f.failRead(false); await act(async () => { await f.api.syncAppProtection(); });
    assert.equal(f.publications.length, 1); assert.equal(f.publications[0].statusReadAccepted, true); assert.equal(f.messages.at(-1), null); assert.equal(f.writes, 0);
  } finally { await f.dispose(); }
});

test('actual modern deferred status never publishes after owner loss or failed scope read', async () => {
  for (const loseScope of ['owner', 'scope']) {
    const gate = deferred(), f = fixture({ readGate: gate }); try {
      await f.mount(); assert.equal(f.reads, 1, 'modern startup must reach the status reader');
      if (loseScope === 'owner') f.loseOwner(); else f.failScope();
      gate.resolve(); await f.drain(); assert.deepEqual(f.publications, []); assert.deepEqual(f.messages, []); assert.equal(f.writes, 0);
    } finally { gate.resolve(); await f.dispose(); }
  }
});

test('Root retries a newly discovered app-group capability even when other saved configuration is identical', async () => {
  const f = fixture({ appGroups: false }); try {
    await f.mount(); await f.drain(); assert.equal(f.reads, 0); assert.equal(f.publications.length, 0);
    assert.ok(f.messages.some(message => message?.includes('could not sync')), 'retired legacy API must remain an honest failure');
    await f.setGroupCapability(true); await f.drain(); assert.equal(f.reads, 1); assert.equal(f.publications[0].statusReadAccepted, true); assert.equal(f.writes, 0);
  } finally { await f.dispose(); }
});

test('modern read-only sync preserves reset-disabled status without reactivating any policy', async () => {
  const f = fixture({ platform: 'android' }); try {
    Object.assign(f.status, { active: false, protectionConfigurationResetDisabled: true });
    await f.mount(); await f.drain(); assert.equal(f.publications[0].protectionConfigurationResetDisabled, true); assert.equal(f.publications[0].active, false); assert.equal(f.writes, 0);
  } finally { await f.dispose(); }
});

test('modern startup status read cannot replace a newer same-owner native policy receipt or its failure notice', async () => {
  const gate = deferred(), f = fixture({ readGate: gate }); try {
    await f.mount(); assert.equal(f.reads, 1);
    const newer = { ...f.status, active: false, adultWebPolicyOperationAccepted: false, adultWebPolicyReason: 'policy-not-observed' };
    f.deps.setProtectionStatus(newer); f.deps.setProtectionSyncMessage('Current policy failure');
    gate.resolve(); await f.drain();
    assert.deepEqual(f.publications, [newer]); assert.deepEqual(f.messages, ['Current policy failure']);
    assert.deepEqual(f.capabilities, []); assert.deepEqual(f.completions, []); assert.deepEqual(f.nativePublications, [newer]);
  } finally { gate.resolve(); await f.dispose(); }
});

test('overlapping real full refresh and modern sync publish one complete observed replacement in either callback order', async () => {
  for (const firstCompletion of ['full', 'sync']) {
    const gates = [deferred(), deferred()], f = fixture({ manualStartup: true, readGates: gates }); try {
      await f.mount(); const refresh = f.api.refreshProtectionStatus();
      let sync!: Promise<any>; await act(async () => { sync = f.api.syncAppProtection(); });
      assert.equal(f.reads, 2);
      if (firstCompletion === 'full') { gates[0].resolve(); assert.equal((await refresh).superseded, true); gates[1].resolve(); }
      else { gates[1].resolve(); await act(async () => { await sync; }); gates[0].resolve(); }
      await act(async () => { await sync; await refresh; });
      assert.deepEqual(f.capabilities, [f.capability]); assert.deepEqual(f.completions, [true]);
      assert.equal(f.publications.length, 1); assert.equal(f.publications[0].statusReadAccepted, true);
      assert.equal(f.coordinator.getSnapshot().capability, f.capability);
      assert.equal(f.coordinator.getSnapshot().status, f.publications[0]);
      assert.deepEqual(f.nativePublications, [], 'a status read is never a native mutation receipt'); assert.equal(f.writes, 0);
    } finally { gates.forEach(gate => gate.resolve()); await f.dispose(); }
  }
});

test('a failing older full refresh cannot remove the modern sync complete observed replacement', async () => {
  const gates = [deferred(), deferred()], f = fixture({ manualStartup: true, readGates: gates, failedReads: [0] }); try {
    await f.mount(); const refresh = f.api.refreshProtectionStatus();
    let sync!: Promise<any>; await act(async () => { sync = f.api.syncAppProtection(); });
    gates[1].resolve(); await act(async () => { await sync; }); gates[0].resolve(); assert.equal((await refresh).superseded, true);
    assert.deepEqual(f.capabilities, [f.capability]); assert.deepEqual(f.completions, [true]);
    assert.equal(f.publications.length, 1); assert.equal(f.publications[0].statusReadAccepted, true); assert.deepEqual(f.nativePublications, []); assert.equal(f.writes, 0);
  } finally { gates.forEach(gate => gate.resolve()); await f.dispose(); }
});

test('a newer real full refresh owns coherent read publication when it overlaps modern sync, including read failure', async () => {
  for (const failFullRead of [false, true]) for (const firstCompletion of ['sync', 'full']) {
    const gates = [deferred(), deferred()], f = fixture({ manualStartup: true, readGates: gates, failedReads: failFullRead ? [1] : [] }); try {
      await f.mount(); let sync!: Promise<any>; await act(async () => { sync = f.api.syncAppProtection(); });
      const rejected = assert.rejects(sync, /cancelled|superseded/);
      const refresh = f.api.refreshProtectionStatus(); assert.equal(f.reads, 2);
      if (firstCompletion === 'sync') { gates[0].resolve(); await act(async () => { await rejected; }); assert.deepEqual(f.publications, []); gates[1].resolve(); }
      else { gates[1].resolve(); await refresh; gates[0].resolve(); }
      await act(async () => { await rejected; await refresh; });
      assert.deepEqual(f.capabilities, [f.capability]); assert.deepEqual(f.completions, [true]); assert.equal(f.publications.length, 1);
      assert.equal(f.publications[0].statusReadAccepted, !failFullRead);
      if (failFullRead) assert.equal(f.publications[0].statusReadError, 'native-status-read-failed');
      assert.equal(f.coordinator.getSnapshot().capability, f.capability); assert.equal(f.coordinator.getSnapshot().status, f.publications[0]);
      assert.deepEqual(f.nativePublications, []); assert.equal(f.writes, 0);
    } finally { gates.forEach(gate => gate.resolve()); await f.dispose(); }
  }
});
