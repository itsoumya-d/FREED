import { createDefaultRecoveryState } from '../../src/lib/recovery-state';
import type { ReminderNotificationsModule } from '../../src/lib/recovery-reminders';

// Stateful Expo boundary: scheduling mutates the same inventory read back by the real scheduler.
export function expoBoundary(initialPermission: any = { status: 'granted', granted: true, canAskAgain: true, expires: 'never', ios: { status: 2 } }) {
  let permission = initialPermission;
  let count = 0;
  const inventory = new Map<string, any>();
  const events: string[] = [];
  const controls = { handler: null as any, beforeSchedule: null as null | (() => Promise<void>), failAt: 0, failReadback: false, failCancel: false, omitNewReadback: false, requests: 0 };
  const api: ReminderNotificationsModule = {
    AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DAILY: 'daily' },
    getPermissionsAsync: async () => permission,
    requestPermissionsAsync: async () => { controls.requests++; return permission; },
    setNotificationHandler: handler => { controls.handler = handler; }, setNotificationChannelAsync: async () => {},
    getAllScheduledNotificationsAsync: async () => { events.push('read'); if (controls.failReadback) throw Error('read failed'); return [...inventory.values()].filter(item => !controls.omitNewReadback || item.identifier.startsWith('old')); },
    scheduleNotificationAsync: async (request: any) => {
      if (controls.beforeSchedule) await controls.beforeSchedule();
      count++; events.push(`schedule:${count}`); if (count === controls.failAt) throw Error('schedule failed');
      const identifier = `new-${count}`;
      const trigger = request.trigger?.type === 'daily' ? { type: 'calendar', repeats: true, dateComponents: { hour: request.trigger.hour, minute: request.trigger.minute, isLeapMonth: false, isRepeatedDay: false } } : request.trigger;
      inventory.set(identifier, { ...request, identifier, trigger }); return identifier;
    },
    cancelScheduledNotificationAsync: async id => { events.push(`cancel:${id}`); if (controls.failCancel) throw Error('cancel failed'); inventory.delete(id); }
  };
  return { api, inventory, events, controls, setPermission: (next: any) => { permission = next; } };
}
export function requested() { return { ...createDefaultRecoveryState().reminders, enabled: true, eveningEnabled: false, guardEnabled: false }; }
export function oldReminder() { return { identifier: 'old-morning', content: { title: 'FREED morning reset', data: { route: 'checkin', kind: 'morning' } }, trigger: { type: 'calendar', repeats: true, dateComponents: { hour: 7, minute: 15, isLeapMonth: false, isRepeatedDay: false } } }; }

