import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind } from 'typescript';
import { createLatestSerialJob } from '../src/lib/latest-serial-job';
import { syncNativeAppGuard, getAppGuardPackages } from '../src/lib/app-guard';
import { buildNativeAppScheduleConfiguration } from '../src/lib/app-schedules';
import { createOwnerRecoveryStore, OWNER_RECOVERY_STORAGE_KEY } from '../src/lib/owner-recovery-store';
import { createDurableStateCell } from '../src/lib/durable-state-cell';
import { createDefaultRecoveryState, hydrateRecoveryState, recordAppSessionStart, touchRecoveryState, updateDisciplineSettings } from '../src/lib/recovery-state';
import { getJourneyOwner } from '../src/lib/user-journey';
import { safeUserFacingMessage } from '../src/lib/user-facing-error';
import { recoverInterruptedWholeAppRestore, ownerRestoreDeletionPending, wholeAppRestoreIntentKey } from '../src/lib/whole-app-restore';

// Keep the actual React hooks, preference reader, Root caller, serial queue and
// app-guard adapter in the test. Only the persistent/native OS boundaries are fake.
const requireLocal = createRequire(`${process.cwd()}/package.json`);
const React = requireLocal('react');
const { create, act } = requireLocal('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => { let resolve!: () => void; return { promise: new Promise<void>(done => { resolve = done; }), resolve: () => resolve() }; };
const compile = (source: string) => transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
const source = readFileSync(process.env.TASK_SYNC_READ_GUARD_SOURCE ?? 'src/features/freed-app.tsx', 'utf8');
const uniqueAnchor = (anchor: string) => {
  const index = source.indexOf(anchor);
  assert.ok(index >= 0, `Missing app-guard fixture extraction anchor: ${anchor}`);
  assert.equal(source.indexOf(anchor, index + anchor.length), -1, `Ambiguous app-guard fixture extraction anchor: ${anchor}`);
  return index;
};
const between = (start: string, end: string) => {
  const a = uniqueAnchor(start), b = uniqueAnchor(end);
  assert.ok(b > a, `Reversed app-guard fixture extraction anchors: ${start} -> ${end}`);
  return source.slice(a, b);
};
const rootScript = between('  const getProtectionActionScope =', '  const knownProtectionScope =') +
  'const knownProtectionScope = getProtectionActionScope();\n' +
  between('  const captureProtectionActionTicket =', '  const appGroups =') +
  between('  const projectGenericProtectionStatus =', '  const refreshProtectionStatus =') +
  // Earned-offer/resume hooks live between these refs and the queue. They are
  // outside app-config read provenance; do not fake their native authority.
  between('  const [appConfigSyncBusy,', '  const earnedAppOrigin =') +
  between('  type AppConfigInput =', '  // Keep the native always-allow list') +
  'return {syncAppProtection,saveAppGuardMode,appConfigQueue,appConfigSyncBusy,appConfigBusyEpoch};';
const recoverySource = readFileSync('src/lib/recovery-storage.ts', 'utf8');
const readerScript = recoverySource.slice(recoverySource.indexOf('export const RECOVERY_STORAGE_KEY')).replaceAll('export function', 'function').replace('export const', 'const') + '\nreturn usePersistentRecoveryState;';
const readerDeps: any = { React, createDefaultRecoveryState, hydrateRecoveryState, recordAppSessionStart, touchRecoveryState, createDurableStateCell, createOwnerRecoveryStore, safeUserFacingMessage,
  recoverInterruptedWholeAppRestore, ownerRestoreDeletionPending, wholeAppRestoreIntentKey };
const useReader = new Function(...Object.keys(readerDeps), compile(readerScript))(...Object.values(readerDeps));
const capability = { platform: 'ios', appGuardModes: true, appSchedules: true, screenTime: true, managedSettings: true };
const accepted = { authorized: true, active: false, message: '', appGuardMode: 'before-use', appGuardModeConfigurationAccepted: true, appSchedulesConfigurationAccepted: true };
const settingsFor = (limit: number) => ({ ...createDefaultRecoveryState(), disciplineSettings: { ...createDefaultRecoveryState().disciplineSettings,
  dailyLimitMinutes: limit, appGuardModeConfiguredAt: '2026-10-08T10:00:00.000Z', sleepModeEnabled: true, sleepModeStart: '22:15', sleepModeEnd: '06:30' } });

function fixture(options: { unreadable?: boolean; publicOwner?: boolean; packagesGate?: ReturnType<typeof deferred>; packagesGates?: ReturnType<typeof deferred>[]; packageErrors?: (Error | undefined)[]; capabilityGate?: ReturnType<typeof deferred> } = {}) {
  const values = new Map<string, string>();
  let owner: string | null = options.publicOwner ? null : 'read-owner-a', sdkOwner = owner, readsFail = false, scopeThrows = false, storageWrites = 0;
  const events: any[] = [], publications: any[] = [], jobs: any[] = [], enteredPackages = deferred(), enteredCapabilities = deferred(), enteredPackageCalls = [deferred(), deferred()]; let packageCalls = 0;
  const storage = { getItem: (key: string) => { if (readsFail && key === OWNER_RECOVERY_STORAGE_KEY) throw Error('controlled preference read failure'); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { storageWrites++; values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const ledger = createOwnerRecoveryStore({ storage, currentOwnerUid: () => owner });
  ledger.activate(owner).save(settingsFor(75));
  readsFail = options.unreadable === true;
  const nativeState: any = { limit: 75, schedules: [{ id: 'sleep', enabled: true }], adultFilterRequested: true, dnsConfigured: true };
  const common: any = { React, createLatestSerialJob: (run: any) => { const queue = createLatestSerialJob(run), submit = queue.submit; queue.submit = (input: any) => { const job = submit(input); jobs.push(job); return job; }; return queue; }, syncNativeAppGuard, getAppGuardPackages, buildNativeAppScheduleConfiguration, updateDisciplineSettings, getJourneyOwner, protectionCapability: capability,
    accountFlowFence: { current: { isActive: () => false } },
    nativePrivateReadState: { get current() { return { hydrated: reader.hydrated, storageReady: reader.storageReady, ownerLease: reader.ownerLease }; } },
    getFirebaseNativeAccountAdmission: () => sdkOwner && owner === sdkOwner ? { ownerUid: sdkOwner, actionScope: JSON.stringify([sdkOwner, 1, '22222222-2222-4222-8222-222222222222']) } : null,
    getFirebaseAuthSnapshot: () => { if (scopeThrows) { scopeThrows = false; throw Error('controlled scope read failure'); } return { status: 'ready', signedIn: owner !== null, anonymous: false, ownerUid: owner, email: null }; },
    getFirebaseAccountScope: () => sdkOwner, privateLockedRef: { current: false }, accountHostGeneration: { current: 1 }, appGroupsMemorySuspended: { current: false }, appGroupsSuspensionEpoch: { current: 0 },
    suspendAppGroupOperations: async () => true, protectionHostAlive: { current: true }, setProtectionStatus: (value: any) => publications.push(value), setProtectionSyncMessage: () => {},
    getProtectionCapabilities: async () => { enteredCapabilities.resolve(); if (options.capabilityGate) await options.capabilityGate.promise; return capability; },
    getProtectionStatus: async () => accepted,
    configureBlockedAppPackages: async (packages: string[], limit: number, shortForm: number) => { const index = packageCalls++; events.push(['packages', packages, limit, shortForm]); enteredPackages.resolve(); enteredPackageCalls[index]?.resolve(); const gate = options.packagesGates?.[index] ?? options.packagesGate; if (gate) await gate.promise; if (options.packageErrors?.[index]) throw options.packageErrors[index]; nativeState.limit = limit; return accepted; },
    configureAppGuardMode: async (mode: string) => { events.push(['mode', mode]); return { ...accepted, appGuardMode: mode }; },
    configureAppSchedules: async (configuration: any) => { events.push(['schedules', configuration]); nativeState.schedules = configuration.schedules; return accepted; } };
  const rootFactory = new Function(...Object.keys(common), 'hydrated', 'storageReady', 'ownerLease', 'persistRecoveryState', 'recoveryStateRef', 'disciplineSettings', compile(rootScript));
  let api: any, reader: any, view: any;
  function Host() {
    // Pass the fake storage lexically to the real extracted preference reader.
    (globalThis as any).localStorage = storage;
    reader = useReader({ ownerId: owner, readOwner: () => owner, authReady: true });
    const recoveryStateRef = React.useRef(reader.state); recoveryStateRef.current = reader.state;
    api = rootFactory(...Object.values(common), reader.hydrated, reader.storageReady, reader.ownerLease, reader.persistRecoveryState, recoveryStateRef, reader.state.disciplineSettings);
    return null;
  }
  const mount = async () => { await act(async () => { view = create(React.createElement(Host)); }); };
  const drain = async () => { await act(async () => { await api.appConfigQueue.current.whenIdle(); }); };
  const retry = async () => { let thrown: unknown; await act(async () => { try { reader.retryRecoveryStateRead(); } catch (error) { thrown = error; } }); return thrown; };
  return { mount, drain, retry, ledger, events, publications, jobs, nativeState, enteredPackages, enteredPackageCalls, enteredCapabilities,
    get reader() { return reader; }, get api() { return api; }, get storageWrites() { return storageWrites; },
    failReads: (value: boolean) => { readsFail = value; }, throwScope: (value: boolean) => { scopeThrows = value; },
    changeOwner: async (next: string, fail: boolean) => { owner = next; sdkOwner = next; readsFail = fail; await act(async () => { view.update(React.createElement(Host)); }); },
    dispose: async () => { await act(async () => { view.unmount(); }); } };
}

test('actual unreadable cold preference fallback performs zero app-guard writes and keeps native limits/schedules', async () => {
  const f = fixture({ unreadable: true }); try {
    await f.mount(); await f.drain();
    assert.equal(f.reader.hydrated, true); assert.equal(f.reader.storageReady, false);
    assert.equal(f.reader.state.disciplineSettings.dailyLimitMinutes, 30);
    assert.deepEqual(f.reader.state.disciplineSettings.blockedAppPackages, []);
    assert.deepEqual(f.events, []); assert.equal(f.nativeState.limit, 75); assert.deepEqual(f.nativeState.schedules, [{ id: 'sleep', enabled: true }]);
    await assert.rejects(f.api.syncAppProtection(), /read|account/i); assert.deepEqual(f.events, []);
    await assert.rejects(f.api.syncAppProtection(settingsFor(10).disciplineSettings), /read|account/i); assert.deepEqual(f.events, []);
    assert.equal(f.nativeState.adultFilterRequested, true); assert.equal(f.nativeState.dnsConfigured, true);
  } finally { await f.dispose(); }
});

test('actual successful read-only retry enables genuine saved rules and explicit persisted updates', async () => {
  const f = fixture({ unreadable: true }); try {
    await f.mount(); await f.drain(); const writes = f.storageWrites;
    f.failReads(false); assert.equal(await f.retry(), undefined); await f.drain();
    assert.equal(f.storageWrites, writes); assert.equal(f.reader.storageReady, true);
    assert.deepEqual(f.events.map(event => event[0]), ['packages', 'mode', 'schedules']);
    assert.deepEqual(f.events[0], ['packages', [], 75, 90]);
    assert.equal(f.events[2][1].schedules.find((schedule: any) => schedule.id === 'sleep').enabled, true);
    f.events.length = 0;
    await act(async () => { const saved = f.reader.persistRecoveryState((current: any) => updateDisciplineSettings(current, { dailyLimitMinutes: 85 })); await f.api.syncAppProtection(saved.disciplineSettings); });
    await f.drain(); assert.ok(f.events.some(event => event[0] === 'packages' && event[2] === 85)); assert.equal(f.nativeState.limit, 85);
    await act(async () => { await f.api.saveAppGuardMode('scheduled'); }); await f.drain();
    assert.equal(f.ledger.readOwner('read-owner-a').disciplineSettings.appGuardMode, 'scheduled');
    assert.ok(f.events.some(event => event[0] === 'mode' && event[1] === 'scheduled'));
  } finally { await f.dispose(); }
});

test('readiness loss after package acknowledgment stops mode/schedule writes and invalidates the job', async () => {
  const release = deferred(), f = fixture({ packagesGate: release }); try {
    await f.mount(); await f.enteredPackages.promise; f.failReads(true); assert.ok(await f.retry());
    assert.equal(f.reader.storageReady, false); const pending = f.api.appConfigQueue.current.latestResult();
    release.resolve(); await f.drain(); assert.equal(await pending, null);
    assert.deepEqual(f.events.map(event => event[0]), ['packages']); assert.deepEqual(f.nativeState.schedules, [{ id: 'sleep', enabled: true }]);
  } finally { release.resolve(); await f.dispose(); }
});

test('owner transition discards an old queued job before any native adapter call', async () => {
  const release = deferred(), f = fixture({ capabilityGate: release }); try {
    await f.mount(); await f.enteredCapabilities.promise;
    await f.changeOwner('read-owner-b', true); const pending = f.api.appConfigQueue.current.latestResult();
    release.resolve(); await f.drain(); assert.equal(await pending, null);
    assert.deepEqual(f.events, []); assert.equal(f.nativeState.limit, 75);
  } finally { release.resolve(); await f.dispose(); }
});

test('revoked readable owner lease stops the remaining native steps before a new render', async () => {
  const release = deferred(), f = fixture({ packagesGate: release }); try {
    await f.mount(); await f.enteredPackages.promise; f.ledger.revoke();
    // Read-ready memory alone cannot authorize the rest of an old native job.
    assert.equal(f.reader.storageReady, true); release.resolve(); await f.drain();
    assert.deepEqual(f.events.map(event => event[0]), ['packages']);
    assert.equal(f.jobs.at(-1).isCurrent(), false);
    assert.deepEqual(f.nativeState.schedules, [{ id: 'sleep', enabled: true }]);
  } finally { release.resolve(); await f.dispose(); }
});

test('failed retry preserves refusal even after the storage boundary can read again', async () => {
  const f = fixture({ unreadable: true }); try {
    await f.mount(); assert.ok(await f.retry()); f.failReads(false);
    await act(async () => { await assert.rejects(f.api.saveAppGuardMode('scheduled'), /read|reload/i); }); await f.drain();
    assert.equal(f.reader.storageReady, false); assert.deepEqual(f.events, []); assert.equal(f.ledger.readOwner('read-owner-a').disciplineSettings.dailyLimitMinutes, 75);
  } finally { await f.dispose(); }
});

test('readable public preferences cannot automatically overwrite the owning native app rules', async () => {
  const f = fixture({ publicOwner: true }); try {
    await f.mount(); await f.drain(); assert.equal(f.reader.storageReady, true); assert.deepEqual(f.events, []);
    await assert.rejects(f.api.syncAppProtection(), /account|owner/i); assert.deepEqual(f.events, []);
  } finally { await f.dispose(); }
});

test('a throwing current scope read stops a queued job before packages without publishing a stale receipt', async () => {
  const release = deferred(), f = fixture({ capabilityGate: release }); try {
    await f.mount(); await f.enteredCapabilities.promise; f.throwScope(true); release.resolve(); await f.drain();
    assert.deepEqual(f.events, []); assert.deepEqual(f.publications, []);
    f.throwScope(true); await assert.rejects(f.api.syncAppProtection()); assert.deepEqual(f.events, []);
  } finally { f.throwScope(false); release.resolve(); await f.dispose(); }
});

test('read loss without another retry settles the actual latest busy request while native rules stay retained', async () => {
  const release = deferred(), f = fixture({ packagesGate: release }); try {
    await f.mount(); await f.enteredPackages.promise;
    assert.equal(f.api.appConfigSyncBusy, true); const displayedEpoch = f.api.appConfigBusyEpoch.current;
    f.failReads(true); assert.ok(await f.retry()); assert.equal(f.reader.storageReady, false);
    await act(async () => { release.resolve(); await f.api.appConfigQueue.current.whenIdle(); });
    assert.equal(f.api.appConfigBusyEpoch.current, displayedEpoch); assert.equal(f.reader.storageReady, false);
    assert.equal(f.jobs.length, 1); assert.equal(f.api.appConfigSyncBusy, false);
    assert.deepEqual(f.events.map(event => event[0]), ['packages']); assert.deepEqual(f.nativeState.schedules, [{ id: 'sleep', enabled: true }]);
  } finally { release.resolve(); await f.dispose(); }
});

test('failed superseded request cannot clear actual busy state while its replacement native write is in flight', async () => {
  const oldRelease = deferred(), replacementRelease = deferred();
  const f = fixture({ packagesGates: [oldRelease, replacementRelease], packageErrors: [new Error('controlled superseded package failure')] });
  let replacement!: Promise<any>;
  try {
    await f.mount(); await f.enteredPackageCalls[0].promise; assert.equal(f.api.appConfigSyncBusy, true);
    await act(async () => { replacement = f.api.syncAppProtection(); });
    await act(async () => { oldRelease.resolve(); await f.enteredPackageCalls[1].promise; });
    assert.equal(f.jobs.length, 2); assert.equal(f.api.appConfigSyncBusy, true);
    assert.deepEqual(f.events.map(event => event[0]), ['packages', 'packages']);
    await act(async () => { replacementRelease.resolve(); await replacement; }); await f.drain();
    assert.equal(f.api.appConfigSyncBusy, false);
    assert.deepEqual(f.events.map(event => event[0]), ['packages', 'packages', 'mode', 'schedules']);
  } finally { oldRelease.resolve(); replacementRelease.resolve(); if (replacement) await act(async () => { await replacement.catch(() => undefined); }); await f.dispose(); }
});
