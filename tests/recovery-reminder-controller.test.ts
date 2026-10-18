import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultRecoveryState, recordReminderSync, updateReminderPreferences, type ReminderPreferenceUpdate } from '../src/lib/recovery-state';
import { createRecoveryRemindersController } from '../src/lib/recovery-reminder-controller';
import { expoBoundary } from './helpers/recovery-reminders-boundary';

function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
function fixture(permission?: any) {
  const boundary = expoBoundary(permission);
  let state = createDefaultRecoveryState(); let ownerId: string | null = 'owner-a'; let timezone = 'Asia/Kolkata|-330';
  const records: Array<{ ownerId: string | null; revision: number }> = [];
  const controller = createRecoveryRemindersController({
    getContext: () => ({ ownerId, hydrated: true, storageReady: true, preferences: state.reminders }),
    updatePreferences: (update: ReminderPreferenceUpdate) => { state = updateReminderPreferences(state, update, '2026-10-07T11:00:00.000Z'); return state.reminders; },
    recordSync: (result: any, context: any) => { records.push(context); state = recordReminderSync(state, result, '2026-10-07T11:01:00.000Z'); },
    options: { platform: 'ios', notifications: boundary.api },
    getTimezone: () => timezone,
    openSettings: async () => { boundary.setPermission({ status: 'granted', granted: true, canAskAgain: true, expires: 'never', ios: { status: 2 } }); }
  });
  return { boundary, controller, records, state: () => state, switchOwner: (owner: string|null) => { ownerId = owner; state = createDefaultRecoveryState(); controller.contextChanged(); }, zone: (value: string) => { timezone = value; } };
}

// Catches an old enable completion undoing a newer off choice, including its busy presentation.
test('real controller serializes rapid enable-disable and only records the latest intention', async () => {
  const f = fixture(); const started = deferred(), release = deferred();
  f.boundary.controls.beforeSchedule = async () => { started.resolve(); await release.promise; };
  const on = f.controller.changePreferences({ enabled: true }); await started.promise;
  const off = f.controller.changePreferences({ enabled: false, guardTime: '23:05' });
  assert.equal(f.controller.getSnapshot().busy, true);
  release.resolve(); await Promise.all([on, off]);
  assert.equal(f.state().reminders.enabled, false); assert.equal(f.state().reminders.guardTime, '23:05');
  assert.equal(f.state().reminders.effectiveStatus, 'off'); assert.equal(f.controller.getSnapshot().busy, false);
  assert.equal(f.records.length, 1); assert.deepEqual([...f.boundary.inventory.keys()], []);
});

test('owner switch fences old callbacks and serializes cleanup before the new owner schedule', async () => {
  const f = fixture(); const started = deferred(), release = deferred();
  f.boundary.controls.beforeSchedule = async () => { started.resolve(); await release.promise; };
  const a = f.controller.changePreferences({ enabled: true }); await started.promise;
  f.switchOwner('owner-b'); const b = f.controller.changePreferences({ enabled: true, morningTime: '10:10', eveningEnabled: false, guardEnabled: false });
  release.resolve(); await Promise.all([a, b]);
  assert.equal(f.records.length, 1); assert.equal(f.records[0].ownerId, 'owner-b');
  assert.equal(f.state().reminders.morningTime, '10:10'); assert.equal(f.state().reminders.effectiveStatus, 'active');
  assert.equal(f.boundary.inventory.size, 1); assert.equal([...f.boundary.inventory.values()][0].trigger.dateComponents.hour, 10);
});

test('coldstart foreground and timezone reconcile never prompt and do not duplicate an intact schedule', async () => {
  const f = fixture({ status: 'undetermined', granted: false, canAskAgain: true, expires: 'never', ios: { status: 0 } });
  await f.controller.changePreferences({ enabled: true });
  assert.equal(f.boundary.controls.requests, 1); assert.equal(f.state().reminders.enabled, true); assert.equal(f.state().reminders.effectiveStatus, 'permission-required');
  await f.controller.reconcile(); assert.equal(f.boundary.controls.requests, 1);
  f.boundary.setPermission({ status: 'granted', granted: true, canAskAgain: true, expires: 'never', ios: { status: 2 } });
  await f.controller.reconcile(); const ids = [...f.boundary.inventory.keys()];
  await f.controller.reconcile(); assert.deepEqual([...f.boundary.inventory.keys()], ids);
  f.zone('Europe/London|0'); await f.controller.reconcile();
  assert.equal(f.boundary.inventory.size, 3); assert.notDeepEqual([...f.boundary.inventory.keys()], ids);
  assert.equal(f.state().reminders.timezone, 'Europe/London|0');
});

test('explicit repair returns from settings and test sends only after the test action', async () => {
  const f = fixture({ status: 'denied', granted: false, canAskAgain: false, expires: 'never', ios: { status: 1 } });
  await f.controller.changePreferences({ enabled: true, guardTime: '23:15' });
  await f.controller.reconcile(); assert.equal(f.boundary.inventory.size, 0);
  await f.controller.repair(); assert.equal(f.state().reminders.effectiveStatus, 'active'); assert.equal(f.state().reminders.guardTime, '23:15');
  assert.equal([...f.boundary.inventory.values()].some(item => item.content.data.kind === 'test'), false);
  const result = await f.controller.sendTestNotification(); assert.equal(result.status, 'sent');
  assert.equal([...f.boundary.inventory.values()].filter(item => item.content.data.kind === 'test').length, 1);
  assert.equal(f.controller.getSnapshot().testStatusMessage, 'Test notification sent.');
});

test('signout removes app-owned requests without recording results into a missing account', async () => {
  const f = fixture(); await f.controller.changePreferences({ enabled: true });
  f.boundary.inventory.set('native-sos', { identifier: 'native-sos', content: { data: { kind: 'sos' } } });
  f.switchOwner(null); await f.controller.reconcile();
  assert.equal(f.records.length, 1); assert.deepEqual([...f.boundary.inventory.keys()], ['native-sos']);
  await f.controller.changePreferences({ enabled: true }); assert.equal(f.state().reminders.enabled, false);
});
