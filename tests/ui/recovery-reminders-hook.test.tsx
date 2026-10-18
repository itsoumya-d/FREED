import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as ReminderRuntime from '@/lib/recovery-reminders';
import { useRecoveryReminders } from '@/hooks/use-recovery-reminders';
import { createDefaultRecoveryState } from '@/lib/recovery-state';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(), scheduleNotificationAsync: jest.fn(), setNotificationHandler: jest.fn()
}));

// Jest's VM cannot perform Expo's native dynamic import in the normal test command.
// Inject only that module-loading boundary; hook, controller and transaction logic stay real.
jest.mock('@/lib/recovery-reminders', () => {
  const actual = jest.requireActual('@/lib/recovery-reminders');
  return {
    ...actual,
    getReminderTimezone: jest.fn(),
    syncRecoveryReminders: (preferences: unknown, options: object) => actual.syncRecoveryReminders(preferences, { ...options, notifications: require('expo-notifications') }),
    sendRecoveryTestNotification: (options: object) => actual.sendRecoveryTestNotification({ ...options, notifications: require('expo-notifications') })
  };
});

let inventory: Map<string, any>;
let permission: any;
let foreground: ((state: string) => void) | undefined;
let timezone: string;
let serial: number;
const originalPlatform = Platform.OS;
const originalAppState = AppState.currentState;

beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-07T10:00:00.000Z'));
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
  inventory = new Map(); serial = 0; timezone = 'Asia/Kolkata|-330';
  permission = { status: 'undetermined', granted: false, canAskAgain: true, expires: 'never', ios: { status: 0, allowsAlert: null, allowsDisplayInNotificationCenter: null, allowsDisplayOnLockScreen: null, allowsBadge: null, allowsSound: null } };
  (ReminderRuntime.getReminderTimezone as jest.Mock).mockImplementation(() => timezone);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => { foreground = listener as any; return { remove: jest.fn() }; });
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  (Notifications.getPermissionsAsync as jest.Mock).mockImplementation(async () => permission);
  (Notifications.requestPermissionsAsync as jest.Mock).mockImplementation(async () => {
    permission = { ...permission, status: 'undetermined', granted: false, ios: { ...permission.ios, status: 3, allowsAlert: false, allowsDisplayInNotificationCenter: true } };
    return permission;
  });
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockImplementation(async () => [...inventory.values()]);
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(async request => {
    const identifier = `hook-${++serial}`;
    const trigger = request.trigger?.type === 'daily' ? { type: 'calendar', repeats: true, dateComponents: { hour: request.trigger.hour, minute: request.trigger.minute } } : request.trigger;
    inventory.set(identifier, { ...request, identifier, trigger }); return identifier;
  });
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockImplementation(async identifier => { inventory.delete(identifier); });
});
afterEach(() => { jest.restoreAllMocks(); Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }); Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: originalAppState }); jest.useRealTimers(); });

function renderReminders() {
  return renderHook(() => {
    const [state, setRecoveryState] = React.useState(createDefaultRecoveryState);
    const accepted = React.useRef(state); accepted.current = state;
    const persistRecoveryState = (update: any) => { const next = typeof update === 'function' ? update(accepted.current) : update; accepted.current = next; setRecoveryState(next); return next; };
    const reminders = useRecoveryReminders({ ownerId: 'owner-a', hydrated: true, recoveryState: state, setRecoveryState, persistRecoveryState, storageReady: true, storageError: null, retryStorageRead: () => accepted.current });
    return { reminders, state };
  });
}
async function flush() { await act(async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); }); }

// Catches hydration reconciliation superseding the explicit enabling prompt or rewriting its chosen time.
test('hook enabling keeps the explicit permission prompt and selected time through React effects', async () => {
  const view = renderReminders(); await flush();
  await act(async () => { await view.result.current.reminders.changePreferences({ enabled: true, guardTime: '23:20' }); });
  await flush();
  expect(view.result.current.state.reminders.enabled).toBe(true);
  expect(view.result.current.state.reminders.guardTime).toBe('23:20');
  expect(view.result.current.state.reminders.permissionStatus).toBe('provisional');
  expect(view.result.current.state.reminders.effectiveStatus).toBe('quiet');
  expect(inventory.size).toBe(3); expect(view.result.current.reminders.busy).toBe(false);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  view.unmount();
});

test('foreground settings and deterministic timezone timer reconcile without delivering test notifications', async () => {
  const view = renderReminders(); await flush();
  await act(async () => { await view.result.current.reminders.changePreferences({ enabled: true }); }); await flush();
  const ids = [...inventory.keys()];
  permission = { ...permission, status: 'denied', granted: false, canAskAgain: false, ios: { ...permission.ios, status: 1 } };
  act(() => { foreground?.('active'); }); await flush();
  expect(view.result.current.state.reminders.enabled).toBe(true);
  expect(view.result.current.state.reminders.effectiveStatus).toBe('permission-required');
  permission = { ...permission, status: 'granted', granted: true, ios: { ...permission.ios, status: 2, allowsAlert: true } };
  act(() => { foreground?.('active'); }); await flush();
  expect(view.result.current.state.reminders.effectiveStatus).toBe('active'); expect([...inventory.keys()]).toEqual(ids);
  timezone = 'Europe/London|0'; act(() => { jest.advanceTimersByTime(60_000); }); await flush();
  expect(inventory.size).toBe(3); expect([...inventory.keys()]).not.toEqual(ids);
  expect(view.result.current.state.reminders.timezone).toBe('Europe/London|0');
  expect([...inventory.values()].some(item => item.content.data.kind === 'test')).toBe(false);
  await act(async () => { await view.result.current.reminders.sendTestNotification(); });
  expect([...inventory.values()].filter(item => item.content.data.kind === 'test')).toHaveLength(1);
  view.unmount();
  jest.runOnlyPendingTimers(); jest.runAllTicks();
  expect(jest.getTimerCount()).toBe(0);
});

// Actual owner ledger + strict durable cell. Only SQLite installation and Expo native APIs are mocked.
jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: async (_algorithm: string, value: string) => require('node:crypto').createHash('sha256').update(value).digest('hex') }));
const { usePersistentRecoveryState } = require('@/lib/recovery-storage');
const { createOwnerRecoveryStore } = require('@/lib/owner-recovery-store');
const { updateReminderPreferences } = require('@/lib/recovery-state');

function durableRemindersFixture(enabled = false) {
  const values = new Map<string, string>(); let ownerId: string | null = 'durable-reminder-a';
  let failure: 'all' | 'receipt' | 'read' | null = null; let writes = 0, readRetryPublications = 0;
  const storage = {
    getItem: (key: string) => { if (failure === 'read' && key === 'freed.recovery.private.v2') throw Error('Controlled owner ledger read failure'); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => {
      const parsed = key === 'freed.recovery.private.v2' ? JSON.parse(value) : null;
      const reminder = parsed?.owners?.[`uid:${encodeURIComponent(ownerId ?? '')}`]?.state?.reminders;
      if (failure === 'all' || (failure === 'receipt' && ['active', 'quiet', 'off'].includes(reminder?.effectiveStatus))) throw Error('Controlled durable reminder disk failure');
      writes++; values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); }
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const ledger = createOwnerRecoveryStore({ storage, currentOwnerUid: () => ownerId });
  const seed = updateReminderPreferences(createDefaultRecoveryState(), { enabled, morningTime: '09:20', eveningEnabled: false, guardEnabled: false });
  ledger.activate(ownerId).save(seed);
  const mount = () => renderHook(() => {
    const persistent = usePersistentRecoveryState({ ownerId, readOwner: () => ownerId });
    const reminders = useRecoveryReminders({ ownerId, hydrated: persistent.hydrated, recoveryState: persistent.state, setRecoveryState: persistent.setRecoveryState, persistRecoveryState: persistent.persistRecoveryState, storageReady: persistent.storageReady, storageError: persistent.storageError, retryStorageRead: () => { const before = writes; const loaded = persistent.retryRecoveryStateRead(); readRetryPublications += writes - before; return loaded; } });
    return { reminders, state: persistent.state, persistent };
  });
  return { ledger, mount, writes: () => writes, readRetryPublications: () => readRetryPublications, fail: (next: typeof failure) => { failure = next; }, owner: (next: string|null) => { ownerId = next; } };
}

// Catches native disable after a swallowed ledger error, which would re-enable on a cold return.
test('actual strict owner hook rejects failed disable before native cancellation and cold return keeps the working schedule', async () => {
  const f = durableRemindersFixture(true); let view = f.mount(); await flush();
  await act(async () => { await view.result.current.reminders.changePreferences({ enabled: true }); }); await flush();
  const ids = [...inventory.keys()]; expect(ids).toHaveLength(1);
  f.fail('all');
  await act(async () => { await view.result.current.reminders.changePreferences({ enabled: false }); }); await flush();
  expect(view.result.current.state.reminders.enabled).toBe(true);
  expect(f.ledger.readOwner('durable-reminder-a').reminders.enabled).toBe(true);
  expect([...inventory.keys()]).toEqual(ids); expect(view.result.current.reminders.storageError).toMatch(/could not be saved|retry/i);
  expect(view.result.current.reminders.busy).toBe(false);
  f.fail(null); view.unmount(); view = f.mount(); await flush();
  expect(view.result.current.state.reminders.enabled).toBe(true); expect([...inventory.keys()]).toEqual(ids);
  view.unmount();
});

test('failed enable and time saves keep the committed intention and native times until explicit retry succeeds', async () => {
  const f = durableRemindersFixture(); const view = f.mount(); await flush();
  f.fail('all'); await act(async () => { await view.result.current.reminders.changePreferences({ enabled: true, morningTime: '10:35' }); }); await flush();
  expect(view.result.current.state.reminders.enabled).toBe(false); expect(inventory.size).toBe(0);
  expect(f.ledger.readOwner('durable-reminder-a').reminders.morningTime).toBe('09:20');
  f.fail(null); await act(async () => { await view.result.current.reminders.repair(); }); await flush();
  expect(view.result.current.state.reminders.enabled).toBe(true); expect(view.result.current.state.reminders.morningTime).toBe('10:35');
  const ids = [...inventory.keys()]; f.fail('all');
  await act(async () => { await view.result.current.reminders.changePreferences({ morningTime: '11:45' }); }); await flush();
  expect(view.result.current.state.reminders.morningTime).toBe('10:35'); expect([...inventory.keys()]).toEqual(ids);
  expect([...inventory.values()][0].trigger.dateComponents.hour).toBe(10);
  view.unmount();
});

test('failed strict sync receipt preserves verified native requests and cold return adopts only the committed owner revision', async () => {
  const f = durableRemindersFixture(); let view = f.mount(); await flush();
  f.fail('receipt'); await act(async () => { await view.result.current.reminders.changePreferences({ enabled: true }); }); await flush();
  const ids = [...inventory.keys()]; expect(ids).toHaveLength(1);
  const durable = f.ledger.readOwner('durable-reminder-a').reminders;
  expect(durable.enabled).toBe(true); expect(durable.effectiveStatus).toBe('pending'); expect(durable.scheduledIds).toEqual([]);
  expect(view.result.current.state.reminders.effectiveStatus).toBe('pending'); expect(view.result.current.reminders.storageError).toMatch(/status|delivery/i);
  expect(view.result.current.reminders.busy).toBe(false);
  f.fail(null); view.unmount(); view = f.mount(); await flush();
  expect([...inventory.keys()]).toEqual(ids);
  expect(f.ledger.readOwner('durable-reminder-a').reminders.scheduledIds).toEqual(ids);
  expect(view.result.current.state.reminders.effectiveStatus).toBe('quiet'); expect(view.result.current.reminders.storageError).toBeNull();
  view.unmount();
});

test('a new owner receipt save retry preserves its verified requests and never replays an old owner failed intent', async () => {
  const f = durableRemindersFixture(); const view = f.mount(); await flush();
  f.fail('all'); await act(async () => { await view.result.current.reminders.changePreferences({ enabled: true, morningTime: '11:45' }); }); await flush();
  f.fail(null); f.owner('durable-reminder-b');
  f.ledger.activate('durable-reminder-b').save(updateReminderPreferences(createDefaultRecoveryState(), { enabled: true, morningTime: '10:10', eveningEnabled: false, guardEnabled: false }));
  permission = { ...permission, status: 'granted', granted: true, ios: { ...permission.ios, status: 2 } };
  f.fail('receipt'); view.rerender(); await flush();
  const ids = [...inventory.keys()]; expect(ids).toHaveLength(1);
  expect(view.result.current.state.reminders.morningTime).toBe('10:10'); expect(view.result.current.reminders.storageError).toMatch(/status/i);
  f.fail(null); await act(async () => { await view.result.current.reminders.repair(); }); await flush();
  expect([...inventory.keys()]).toEqual(ids);
  expect(f.ledger.readOwner('durable-reminder-b').reminders.morningTime).toBe('10:10');
  expect(f.ledger.readOwner('durable-reminder-a').reminders.enabled).toBe(false);
  expect(view.result.current.reminders.storageError).toBeNull(); view.unmount();
});

test('cold unreadable owner ledger keeps native requests and history until explicit read-only retry succeeds', async () => {
  const f = durableRemindersFixture(true); let view = f.mount(); await flush();
  await act(async () => { await view.result.current.reminders.changePreferences({ enabled: true }); }); await flush();
  inventory.set('native-sos', { identifier: 'native-sos', content: { data: { kind: 'sos' } } });
  const ids = [...inventory.keys()]; const writes = f.writes(); const schedules = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.length;
  view.unmount(); f.fail('read'); view = f.mount(); await flush();
  expect(view.result.current.persistent.hydrated).toBe(true); expect(view.result.current.state.reminders.enabled).toBe(false);
  expect([...inventory.keys()]).toEqual(ids); expect(f.writes()).toBe(writes);
  expect(view.result.current.reminders.storageError).toMatch(/read|reload/i);
  await act(async () => {
    await view.result.current.reminders.changePreferences({ enabled: false, morningTime: '11:45' });
    await view.result.current.reminders.sendTestNotification();
    await view.result.current.reminders.reconcile();
    await view.result.current.reminders.repair();
  }); await flush();
  expect([...inventory.keys()]).toEqual(ids); expect(f.writes()).toBe(writes);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(schedules);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  expect(view.result.current.reminders.busy).toBe(false);
  f.fail(null);
  expect(f.ledger.readOwner('durable-reminder-a').reminders.enabled).toBe(true);
  expect(f.ledger.readOwner('durable-reminder-a').reminders.morningTime).toBe('09:20');
  const beforeRetry = f.writes();
  await act(async () => { await view.result.current.reminders.repair(); }); await flush();
  expect(f.readRetryPublications()).toBe(0); // The reader itself never publishes a ledger or session-start write.
  expect(f.writes()).toBeGreaterThan(beforeRetry); // Reconciliation can commit idempotent receipts after the read; the reader itself publishes none.
  expect(view.result.current.state.reminders.enabled).toBe(true);
  expect(view.result.current.state.reminders.morningTime).toBe('09:20'); expect([...inventory.keys()]).toEqual(ids);
  expect(view.result.current.reminders.storageError).toBeNull(); view.unmount();
});
