import type { ReminderPreferenceUpdate, ReminderPreferences } from '@/lib/recovery-state';
import { getReminderTimezone, sendRecoveryTestNotification, syncRecoveryReminders, type ReminderSyncOptions, type ReminderSyncResult, type ReminderTestResult } from '@/lib/recovery-reminders';

export type RecoveryReminderContext = { ownerId: string | null; hydrated: boolean; storageReady: boolean; storageReadError?: string | null; preferences: ReminderPreferences };
export type RecoveryReminderControllerDependencies = {
  getContext: () => RecoveryReminderContext;
  updatePreferences: (update: ReminderPreferenceUpdate) => ReminderPreferences;
  recordSync: (result: ReminderSyncResult, context: { ownerId: string; revision: number }) => void;
  options?: ReminderSyncOptions;
  openSettings: () => Promise<unknown>;
  getTimezone?: () => string;
  getOwnerKey?: (ownerId: string) => Promise<string>;
  retryStorageRead?: () => void;
};
export type RecoveryReminderControllerSnapshot = { busy: boolean; testStatusMessage: string | null; storageError: string | null };

function contextKey(context: RecoveryReminderContext) {
  const p = context.preferences;
  return JSON.stringify([context.ownerId, context.hydrated, context.storageReady, p.revision, p.enabled, p.morningEnabled, p.eveningEnabled, p.guardEnabled, p.morningTime, p.eveningTime, p.guardTime]);
}

/** Intention is synchronous; device writes are serialized by the scheduler and fenced again before state callbacks. */
export function createRecoveryRemindersController(dependencies: RecoveryReminderControllerDependencies) {
  let snapshot: RecoveryReminderControllerSnapshot = { busy: false, testStatusMessage: null, storageError: null };
  const subscribers = new Set<() => void>();
  let epoch = 0;
  let observedContext = dependencies.getContext();
  let observedKey = contextKey(observedContext);
  let forceOwnerReplacement = false;
  let failedIntent: { key: string; update: ReminderPreferenceUpdate } | null = null;
  let pending: { key: string; requestPermission: boolean; epoch: number; promise: Promise<void> } | null = null;
  const publish = (update: Partial<RecoveryReminderControllerSnapshot>) => {
    snapshot = { ...snapshot, ...update };
    for (const listener of subscribers) listener();
  };
  const blockUnreadableStorage = () => {
    const message = 'Saved reminder choices could not be read. Existing reminders were kept. Retry to reload saved choices.';
    publish({ busy: false, storageError: message, testStatusMessage: message });
  };
  const contextChanged = () => {
    const next = dependencies.getContext();
    const key = contextKey(next);
    if (observedKey === key) return;
    if (failedIntent && failedIntent.key !== key) failedIntent = null;
    if (observedContext.ownerId !== next.ownerId) { forceOwnerReplacement = true; failedIntent = null; publish({ testStatusMessage: null, storageError: null }); }
    observedContext = next; observedKey = key; epoch++;
    if (!next.hydrated) publish({ busy: false });
  };
  const runSync = (requestPermission = false): Promise<void> => {
    contextChanged();
    const context = dependencies.getContext();
    if (!context.hydrated) return Promise.resolve();
    if (!context.storageReady) { blockUnreadableStorage(); return Promise.resolve(); }
    const timezone = dependencies.getTimezone?.() ?? getReminderTimezone();
    const key = `${contextKey(context)}|${timezone}`;
    if (pending?.key === key && pending.epoch === epoch && (!requestPermission || pending.requestPermission)) return pending.promise;
    const operationEpoch = ++epoch;
    const capturedKey = contextKey(context);
    const isCurrent = () => epoch === operationEpoch && contextKey(dependencies.getContext()) === capturedKey;
    publish({ busy: true, ...(!failedIntent ? { storageError: null, testStatusMessage: null } : {}) });
    const preferences = context.ownerId ? context.preferences : { ...context.preferences, enabled: false };
    const promise = (async () => {
      const ownerKey = context.ownerId && dependencies.getOwnerKey ? await dependencies.getOwnerKey(context.ownerId) : dependencies.options?.ownerKey;
      if (!isCurrent()) return;
      const result = await syncRecoveryReminders(preferences, { ...dependencies.options, ownerKey, requestPermission, timezone, forceReplace: forceOwnerReplacement, isCurrent });
      if (!isCurrent() || result.stale) return;
      // Native owner replacement is already verified even if the following ledger receipt fails.
      if (['active', 'quiet', 'off'].includes(result.effectiveStatus)) forceOwnerReplacement = false;
      if (context.ownerId) {
        try {
          dependencies.recordSync(result, { ownerId: context.ownerId, revision: context.preferences.revision });
          if (!failedIntent) publish({ storageError: null, testStatusMessage: null });
        } catch {
          // Verified native requests remain in place. Their owner/revision metadata allows cold reconciliation.
          if (isCurrent()) {
            const message = 'Reminder timing is saved, but delivery status could not be saved. Verified reminders were kept. Retry to save their status.';
            publish({ storageError: message, testStatusMessage: message });
          }
          return;
        }
      }
      forceOwnerReplacement = false;
    })()
      .catch(() => {
        if (isCurrent()) publish({ testStatusMessage: 'The reminder account could not be verified. Retry to repair reminders.' });
      })
      .finally(() => {
        if (epoch === operationEpoch) { pending = null; publish({ busy: false }); }
      });
    pending = { key, requestPermission, epoch: operationEpoch, promise };
    return promise;
  };
  const changePreferences = (update: ReminderPreferenceUpdate): Promise<void> => {
    const context = dependencies.getContext();
    if (!context.hydrated || !context.ownerId) return Promise.resolve();
    if (!context.storageReady) { blockUnreadableStorage(); return Promise.resolve(); }
    try {
      dependencies.updatePreferences(update);
      failedIntent = null;
    } catch {
      // A strict durability rejection leaves both accepted intention and native schedules untouched.
      if (contextKey(dependencies.getContext()) === contextKey(context)) {
        failedIntent = { key: contextKey(context), update: { ...update } };
        const message = 'Reminder changes could not be saved on this device. Existing reminders were kept. Retry your change.';
        publish({ storageError: message, testStatusMessage: message });
      }
      return Promise.resolve();
    }
    return runSync(update.enabled === true);
  };
  const repair = async () => {
    contextChanged();
    const context = dependencies.getContext();
    if (!context.hydrated || !context.ownerId) return;
    if (!context.storageReady) {
      const ownerId = context.ownerId;
      try {
        if (!dependencies.retryStorageRead) throw new Error('Saved reminder choices could not be read.');
        dependencies.retryStorageRead();
        if (dependencies.getContext().ownerId !== ownerId || !dependencies.getContext().storageReady) return;
        publish({ storageError: null, testStatusMessage: null });
        return runSync(false);
      } catch {
        if (dependencies.getContext().ownerId === ownerId) blockUnreadableStorage();
        return;
      }
    }
    if (failedIntent?.key === contextKey(context)) return changePreferences(failedIntent.update);
    const key = contextKey(context);
    const repairEpoch = ++epoch;
    publish({ busy: true });
    try {
      if (['denied', 'provisional', 'ephemeral'].includes(context.preferences.permissionStatus)) await dependencies.openSettings();
      if (epoch !== repairEpoch || contextKey(dependencies.getContext()) !== key) return;
      await runSync(true);
    } catch {
      if (epoch === repairEpoch) publish({ testStatusMessage: 'Notification settings could not be opened. Retry to repair reminders.' });
    } finally {
      if (epoch === repairEpoch) publish({ busy: false });
    }
  };
  const sendTestNotification = async (): Promise<ReminderTestResult> => {
    contextChanged();
    const context = dependencies.getContext();
    const key = contextKey(context);
    if (!context.hydrated || !context.ownerId) return { status: 'stale', permissionStatus: context.preferences.permissionStatus, statusMessage: 'Connect the current account before testing reminders.' };
    if (!context.storageReady) {
      blockUnreadableStorage();
      return { status: 'failed', permissionStatus: context.preferences.permissionStatus, statusMessage: snapshot.storageError! };
    }
    const operationEpoch = ++epoch;
    const isCurrent = () => epoch === operationEpoch && contextKey(dependencies.getContext()) === key;
    publish({ busy: true, testStatusMessage: null });
    const result = await sendRecoveryTestNotification({ ...dependencies.options, isCurrent });
    if (isCurrent()) publish({ busy: false, testStatusMessage: result.statusMessage });
    return result;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; },
    contextChanged,
    changePreferences,
    reconcile: () => runSync(false),
    repair,
    sendTestNotification
  };
}
