import React from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { createRecoveryRemindersController } from '@/lib/recovery-reminder-controller';
import { getReminderTimezone } from '@/lib/recovery-reminders';
import { recordReminderSync, updateReminderPreferences, type RecoveryState } from '@/lib/recovery-state';

type RecoveryRemindersHookOptions = {
  ownerId: string | null;
  hydrated: boolean;
  storageReady: boolean;
  storageError: string | null;
  retryStorageRead: () => RecoveryState;
  recoveryState: RecoveryState;
  setRecoveryState: React.Dispatch<React.SetStateAction<RecoveryState>>;
  persistRecoveryState: (update: RecoveryState | ((current: RecoveryState) => RecoveryState)) => RecoveryState;
};

export function useRecoveryReminders(options: RecoveryRemindersHookOptions) {
  const latest = React.useRef(options);
  latest.current = options;
  const controllerRef = React.useRef<ReturnType<typeof createRecoveryRemindersController> | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createRecoveryRemindersController({
      getContext: () => ({ ownerId: latest.current.ownerId, hydrated: latest.current.hydrated, storageReady: latest.current.storageReady, storageReadError: latest.current.storageError, preferences: latest.current.recoveryState.reminders }),
      updatePreferences: update => {
        const ownerId = latest.current.ownerId;
        const updatedAt = new Date().toISOString();
        const next = latest.current.persistRecoveryState(current => {
          if (!ownerId || latest.current.ownerId !== ownerId || !latest.current.hydrated || !latest.current.storageReady) throw new Error('The reminder account changed.');
          return updateReminderPreferences(current, update, updatedAt);
        });
        if (latest.current.ownerId !== ownerId) throw new Error('The reminder account changed.');
        // Only the strict commit's accepted return value may become scheduling intention.
        latest.current = { ...latest.current, recoveryState: next };
        return next.reminders;
      },
      recordSync: (result, context) => {
        const syncedAt = new Date().toISOString();
        const next = latest.current.persistRecoveryState(current => {
          if (latest.current.ownerId !== context.ownerId || !latest.current.hydrated || !latest.current.storageReady || current.reminders.revision !== context.revision) throw new Error('The reminder account or preference changed.');
          return recordReminderSync(current, result, syncedAt);
        });
        if (latest.current.ownerId !== context.ownerId) throw new Error('The reminder account changed.');
        latest.current = { ...latest.current, recoveryState: next };
      },
      retryStorageRead: () => {
        const ownerId = latest.current.ownerId;
        const loaded = latest.current.retryStorageRead();
        if (!ownerId || latest.current.ownerId !== ownerId) throw new Error('The reminder account changed.');
        // This boundary returns only a successful current-owner ledger read, never fallback defaults.
        latest.current = { ...latest.current, recoveryState: loaded, storageReady: true, storageError: null };
      },
      getOwnerKey: async ownerId => {
        const Crypto = require('expo-crypto') as typeof import('expo-crypto');
        return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `freed-reminder-owner-v1:${ownerId}`);
      },
      options: { platform: Platform.OS },
      openSettings: () => Linking.openSettings()
    });
  }
  const controller = controllerRef.current;
  const snapshot = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const p = options.recoveryState.reminders;
  const intentKey = JSON.stringify([p.revision, p.enabled, p.morningEnabled, p.eveningEnabled, p.guardEnabled, p.morningTime, p.eveningTime, p.guardTime]);
  React.useEffect(() => {
    controller.contextChanged();
    void controller.reconcile();
  }, [controller, options.ownerId, options.hydrated, options.storageReady, intentKey]);
  React.useEffect(() => {
    let timezone = getReminderTimezone();
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') { timezone = getReminderTimezone(); void controller.reconcile(); }
    });
    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const currentTimezone = getReminderTimezone();
      if (currentTimezone !== timezone) { timezone = currentTimezone; void controller.reconcile(); }
    }, 60_000);
    return () => { appState.remove(); clearInterval(interval); latest.current = { ...latest.current, hydrated: false }; controller.contextChanged(); };
  }, [controller]);
  return { ...snapshot, changePreferences: controller.changePreferences, repair: controller.repair, sendTestNotification: controller.sendTestNotification, reconcile: controller.reconcile };
}
