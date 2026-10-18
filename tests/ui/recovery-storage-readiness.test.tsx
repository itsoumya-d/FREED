import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { usePersistentRecoveryState } from '@/lib/recovery-storage';
import { createOwnerRecoveryStore, OWNER_RECOVERY_STORAGE_KEY } from '@/lib/owner-recovery-store';
import { createDefaultRecoveryState, updateReminderPreferences } from '@/lib/recovery-state';
jest.mock('expo-sqlite/localStorage/install', () => ({}));

function fixture() {
  const values = new Map<string,string>(); let ownerId: string|null = 'read-owner-a'; let readsFail = false, writesFail = false, writes = 0;
  const storage = {
    getItem: (key: string) => { if (readsFail && key === OWNER_RECOVERY_STORAGE_KEY) throw Error('controlled owner ledger read failure'); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (writesFail) throw Error('controlled owner ledger write failure'); writes++; values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const ledger = createOwnerRecoveryStore({ storage, currentOwnerUid: () => ownerId });
  const seed = updateReminderPreferences({ ...createDefaultRecoveryState(), completedChallenges: 11 }, { enabled: true, morningTime: '09:20' });
  ledger.activate(ownerId).save(seed);
  const mount = () => renderHook(() => usePersistentRecoveryState({ ownerId, readOwner: () => ownerId }));
  return { ledger, storage, mount, readsFail: (value: boolean) => { readsFail = value; }, writesFail: (value: boolean) => { writesFail = value; }, writes: () => writes, owner: (value: string|null) => { ownerId = value; } };
}

test('unreadable fallback rejects strict updater before execution and read-only retry restores hidden history without publication', () => {
  const f = fixture(); f.readsFail(true); const view = f.mount(); const writes = f.writes();
  expect(view.result.current.hydrated).toBe(true); expect(view.result.current.state.completedChallenges).toBe(0);
  f.readsFail(false); let updaterExecuted = false;
  act(() => { expect(() => view.result.current.persistRecoveryState(current => { updaterExecuted = true; return updateReminderPreferences(current, { enabled: false }); })).toThrow(/read|reload/i); });
  expect(updaterExecuted).toBe(false); expect(f.writes()).toBe(writes);
  expect(f.ledger.readOwner('read-owner-a').completedChallenges).toBe(11); expect(view.result.current.storageReady).toBe(false);
  act(() => { const reloaded = view.result.current.retryRecoveryStateRead(); expect(reloaded.completedChallenges).toBe(11); });
  expect(f.writes()).toBe(writes); expect(view.result.current.state.completedChallenges).toBe(11);
  expect(view.result.current.state.reminders.enabled).toBe(true); expect(view.result.current.storageReady).toBe(true); expect(view.result.current.storageError).toBeNull();
  act(() => { view.result.current.persistRecoveryState(current => updateReminderPreferences(current, { enabled: false })); });
  expect(f.ledger.readOwner('read-owner-a').completedChallenges).toBe(11); expect(f.ledger.readOwner('read-owner-a').reminders.enabled).toBe(false);
  view.unmount();
});

test('save rejection retains read provenance and a stale reader cannot publish or invalidate a new owner', () => {
  const f = fixture(); const view = f.mount(); const aReader = view.result.current.retryRecoveryStateRead;
  f.writesFail(true); act(() => { expect(() => view.result.current.persistRecoveryState(current => updateReminderPreferences(current, { enabled: false }))).toThrow(); });
  expect(view.result.current.storageReady).toBe(true); expect(view.result.current.state.completedChallenges).toBe(11);
  f.writesFail(false); f.owner('read-owner-b'); f.ledger.activate('read-owner-b').save({ ...createDefaultRecoveryState(), completedChallenges: 22 }); view.rerender();
  const writes = f.writes(); expect(view.result.current.state.completedChallenges).toBe(22); expect(view.result.current.storageReady).toBe(true);
  act(() => { expect(() => aReader()).toThrow(/owner|read/i); });
  expect(f.writes()).toBe(writes); expect(view.result.current.state.completedChallenges).toBe(22);
  expect(view.result.current.storageReady).toBe(true); expect(view.result.current.storageError).toBeNull(); view.unmount();
});

test('suspension revokes readable provenance until the same owner is explicitly resumed and read', () => {
  const f = fixture(); const view = f.mount(); expect(view.result.current.storageReady).toBe(true);
  act(() => { view.result.current.suspendOwner(); });
  expect(view.result.current.storageReady).toBe(false);
  act(() => { expect(() => view.result.current.persistRecoveryState(current => current)).toThrow(); });
  act(() => { view.result.current.resumeOwner(); });
  expect(view.result.current.storageReady).toBe(true); expect(view.result.current.state.completedChallenges).toBe(11);
  expect(view.result.current.state.reminders.morningTime).toBe('09:20'); view.unmount();
});

test('read-only retry cannot bypass a pending restore marker or promote its retained history as ready', () => {
  const f = fixture();
  f.storage.setItem('freed.restore.intent.v1.read-owner-a', '{}');
  const view = f.mount(); const writes = f.writes(); expect(view.result.current.storageReady).toBe(false);
  act(() => { expect(() => view.result.current.retryRecoveryStateRead()).toThrow(/restore|rollback/i); });
  expect(view.result.current.storageReady).toBe(false); expect(f.writes()).toBe(writes);
  expect(f.ledger.readOwner('read-owner-a').completedChallenges).toBe(11);
  expect(f.storage.getItem('freed.restore.intent.v1.read-owner-a')).toBe('{}'); view.unmount();
});
