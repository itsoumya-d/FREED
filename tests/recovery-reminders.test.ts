import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultRecoveryState, hydrateRecoveryState, recordReminderSync, updateReminderPreferences } from '../src/lib/recovery-state';
import { syncRecoveryReminders } from '../src/lib/recovery-reminders';

import { expoBoundary, requested, oldReminder } from './helpers/recovery-reminders-boundary';

// Catches checking only Expo's general status, which is undetermined for native provisional.
test('iOS provisional permits quiet reminders without prompting and preserves requested times', async () => {
  const boundary = expoBoundary({ status: 'undetermined', granted: false, canAskAgain: true, expires: 'never', ios: { status: 3, allowsAlert: false, allowsDisplayInNotificationCenter: true } });
  const result = await syncRecoveryReminders({ ...requested(), morningTime: '09:40' }, { platform: 'ios', notifications: boundary.api });
  assert.equal(result.permissionStatus, 'provisional');
  assert.equal(result.effectiveStatus, 'quiet');
  assert.equal(result.enabled, true);
  assert.equal(boundary.controls.requests, 0);
  assert.equal(boundary.inventory.get('new-1')?.trigger.dateComponents.hour, 9);
  assert.equal(boundary.inventory.get('new-1')?.trigger.dateComponents.minute, 40);
});

test('denial reports repair while recording observed status keeps desired enabled', async () => {
  const state = updateReminderPreferences(createDefaultRecoveryState(), { enabled: true, guardTime: '22:10' });
  const boundary = expoBoundary({ status: 'denied', granted: false, canAskAgain: false, expires: 'never', ios: { status: 1 } });
  const result = await syncRecoveryReminders(state.reminders, { platform: 'ios', notifications: boundary.api });
  const recorded = recordReminderSync(state, result);
  assert.equal(recorded.reminders.enabled, true);
  assert.equal(recorded.reminders.guardTime, '22:10');
  assert.equal(recorded.reminders.effectiveStatus, 'permission-required');
  assert.equal(boundary.controls.requests, 0);
});

test('replacement is read back before old reminders are removed and unrelated native notifications survive', async () => {
  const boundary = expoBoundary(); boundary.inventory.set('old-morning', oldReminder());
  boundary.inventory.set('native-sos', { identifier: 'native-sos', content: { data: { kind: 'sos' } } });
  const result = await syncRecoveryReminders({ ...requested(), scheduledIds: ['old-morning', 'native-sos'] }, { platform: 'ios', notifications: boundary.api });
  assert.equal(result.effectiveStatus, 'active');
  assert.deepEqual([...boundary.inventory.keys()], ['native-sos', 'new-1']);
  assert.ok(boundary.events.indexOf('cancel:old-morning') > boundary.events.indexOf('schedule:1'));
  assert.ok(boundary.events.slice(boundary.events.indexOf('schedule:1') + 1, boundary.events.indexOf('cancel:old-morning')).includes('read'));
});

test('partial replacement failure cleans new requests and preserves old working reminders', async () => {
  const boundary = expoBoundary(); boundary.inventory.set('old-morning', oldReminder()); boundary.controls.failAt = 2;
  const result = await syncRecoveryReminders({ ...requested(), guardEnabled: true, scheduledIds: ['old-morning'] }, { platform: 'ios', notifications: boundary.api });
  assert.equal(result.effectiveStatus, 'failed');
  assert.deepEqual(result.scheduledIds, ['old-morning']);
  assert.deepEqual([...boundary.inventory.keys()], ['old-morning']);
  assert.equal(result.enabled, true);
});

test('missing replacement readback never discards old working notifications', async () => {
  const boundary = expoBoundary(); boundary.inventory.set('old-morning', oldReminder()); boundary.controls.omitNewReadback = true;
  const result = await syncRecoveryReminders({ ...requested(), scheduledIds: ['old-morning'] }, { platform: 'ios', notifications: boundary.api });
  assert.equal(result.effectiveStatus, 'failed'); assert.deepEqual([...boundary.inventory.keys()], ['old-morning']);
});

test('disable cancels app-owned reminders discovered after restart and leaves native recovery actions', async () => {
  const boundary = expoBoundary(); boundary.inventory.set('old-morning', oldReminder());
  boundary.inventory.set('native-intervention', { identifier: 'native-intervention', content: { data: { route: 'checkin', kind: 'intervention' } } });
  const result = await syncRecoveryReminders({ ...requested(), enabled: false, scheduledIds: [] }, { platform: 'ios', notifications: boundary.api });
  assert.equal(result.effectiveStatus, 'off'); assert.deepEqual([...boundary.inventory.keys()], ['native-intervention']);
});

test('legacy hydration preserves intent and times without inferring scheduling success', () => {
  const legacy = hydrateRecoveryState({ ...createDefaultRecoveryState(), reminders: { enabled: true, morningTime: '09:25', guardTime: '23:10', scheduledIds: ['old-morning'], permissionStatus: 'granted', lastScheduledAt: '2026-10-06T10:00:00.000Z' } });
  assert.equal(legacy.reminders.enabled, true); assert.equal(legacy.reminders.morningTime, '09:25'); assert.equal(legacy.reminders.guardTime, '23:10');
  assert.equal(legacy.reminders.permissionStatus, 'authorized'); assert.equal(legacy.reminders.effectiveStatus, 'pending');
  assert.equal(legacy.reminders.contractVersion, 2);
});

test('old sync result cannot flip or overwrite a newer preference revision', async () => {
  const on = updateReminderPreferences(createDefaultRecoveryState(), { enabled: true });
  const result = await syncRecoveryReminders(on.reminders, { platform: 'ios', notifications: expoBoundary().api });
  const off = updateReminderPreferences(on, { enabled: false, morningTime: '10:25' });
  assert.equal(recordReminderSync(off, result), off);
});


// Catches deleting a verified replacement when cleanup of the previous schedule fails.
test('old cancellation failure retains verified new reminders for repair rather than removing them', async () => {
  const boundary = expoBoundary(); boundary.inventory.set('old-morning', oldReminder()); boundary.controls.failCancel = true;
  const result = await syncRecoveryReminders({ ...requested(), scheduledIds: ['old-morning'] }, { platform: 'ios', notifications: boundary.api });
  assert.equal(result.effectiveStatus, 'failed');
  assert.deepEqual([...boundary.inventory.keys()], ['old-morning', 'new-1']);
  assert.deepEqual(result.scheduledIds, ['old-morning', 'new-1']);
  assert.equal(boundary.events.includes('cancel:new-1'), false);
});

test('iOS calendar readback must repeat daily before an active schedule is reported', async () => {
  const boundary = expoBoundary();
  const read = boundary.api.getAllScheduledNotificationsAsync;
  boundary.api.getAllScheduledNotificationsAsync = async () => (await read()).map(item => ({ ...item, trigger: { type: 'calendar', repeats: false, dateComponents: { hour: 8, minute: 30 } } }));
  const result = await syncRecoveryReminders(requested(), { platform: 'ios', notifications: boundary.api });
  assert.equal(result.effectiveStatus, 'failed'); assert.equal(boundary.inventory.size, 0);
});

test('native permission readback after scheduling catches a concurrent Settings revoke', async () => {
  const boundary = expoBoundary();
  const schedule = boundary.api.scheduleNotificationAsync;
  boundary.api.scheduleNotificationAsync = async input => {
    const id = await schedule(input);
    boundary.setPermission({ status: 'denied', granted: false, canAskAgain: false, expires: 'never', ios: { status: 1 } });
    return id;
  };
  const result = await syncRecoveryReminders(requested(), { platform: 'ios', notifications: boundary.api });
  assert.equal(result.effectiveStatus, 'permission-required'); assert.equal(result.permissionStatus, 'denied');
  assert.equal(boundary.inventory.size, 0);
});

test('legacy active copy becomes a pending device check instead of a migrated success claim', () => {
  const state = hydrateRecoveryState({ reminders: { enabled: true, permissionStatus: 'granted', scheduledIds: ['old-morning'], statusMessage: '3 local recovery reminders scheduled.' } });
  assert.equal(state.reminders.effectiveStatus, 'pending'); assert.equal(state.reminders.statusMessage, 'Checking recovery reminders on this device.');
});

test('iOS ephemeral permission is accepted while an undetermined passive read never prompts', async () => {
  const ephemeral = expoBoundary({ status: 'undetermined', granted: false, canAskAgain: true, expires: 'never', ios: { status: 4 } });
  const active = await syncRecoveryReminders(requested(), { platform: 'ios', notifications: ephemeral.api });
  assert.equal(active.permissionStatus, 'ephemeral'); assert.equal(active.effectiveStatus, 'active'); assert.equal(ephemeral.controls.requests, 0);
  const undetermined = expoBoundary({ status: 'undetermined', granted: false, canAskAgain: true, expires: 'never', ios: { status: 0 } });
  const pending = await syncRecoveryReminders(requested(), { platform: 'ios', notifications: undetermined.api });
  assert.equal(pending.effectiveStatus, 'permission-required'); assert.equal(undetermined.controls.requests, 0); assert.equal(undetermined.inventory.size, 0);
});

test('unsupported local reminders preserve intent and do not import or call a provider', async () => {
  const state = updateReminderPreferences(createDefaultRecoveryState(), { enabled: true, morningTime: '08:15' });
  const result = await syncRecoveryReminders(state.reminders, { platform: 'web' });
  const recorded = recordReminderSync(state, result);
  assert.equal(recorded.reminders.enabled, true); assert.equal(recorded.reminders.permissionStatus, 'unsupported');
  assert.equal(recorded.reminders.effectiveStatus, 'permission-required'); assert.equal(recorded.reminders.morningTime, '08:15');
});

test('turning every reminder slot off removes the old schedule while preserving the master preference', async () => {
  const boundary = expoBoundary(); boundary.inventory.set('old-morning', oldReminder());
  const preferences = { ...requested(), morningEnabled: false, eveningEnabled: false, guardEnabled: false, scheduledIds: ['old-morning'] };
  const result = await syncRecoveryReminders(preferences, { platform: 'ios', notifications: boundary.api });
  assert.equal(result.enabled, true); assert.equal(result.effectiveStatus, 'off'); assert.equal(boundary.inventory.size, 0);
  const state = createDefaultRecoveryState(); state.reminders = preferences;
  assert.equal(recordReminderSync(state, result).reminders.effectiveStatus, 'off');
});

test('Android denied app-level status requires repair even if the runtime granted boolean is retained', async () => {
  const boundary = expoBoundary({ status: 'denied', granted: true, canAskAgain: true, expires: 'never', android: { importance: 0, interruptionFilter: 1 } });
  const result = await syncRecoveryReminders(requested(), { platform: 'android', notifications: boundary.api });
  assert.equal(result.permissionStatus, 'denied'); assert.equal(result.effectiveStatus, 'permission-required'); assert.equal(boundary.inventory.size, 0);
});

test('coldstart with an intact native schedule still restores the foreground display policy', async () => {
  const boundary = expoBoundary(); const first = await syncRecoveryReminders(requested(), { platform: 'ios', notifications: boundary.api, timezone: 'Asia/Kolkata|-330' });
  boundary.controls.handler = null;
  const restored = await syncRecoveryReminders({ ...requested(), scheduledIds: first.scheduledIds }, { platform: 'ios', notifications: boundary.api, timezone: 'Asia/Kolkata|-330' });
  assert.deepEqual(restored.scheduledIds, first.scheduledIds);
  assert.ok(boundary.controls.handler, 'native foreground handling must be restored without replacing an intact schedule');
  assert.deepEqual(await boundary.controls.handler.handleNotification(), { shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true });
});

// Native ownership/revision is the recoverable authority when a durable sync receipt was rejected.
test('matching opaque owner and committed revision recover a lost native receipt without rescheduling', async () => {
  const boundary = expoBoundary(); const ownerKey = 'a'.repeat(64);
  const preferences = { ...requested(), revision: 7, morningTime: '09:20' };
  const first = await syncRecoveryReminders(preferences, { platform: 'ios', notifications: boundary.api, ownerKey, timezone: 'Asia/Kolkata|-330' });
  const cold = await syncRecoveryReminders({ ...preferences, scheduledIds: [] }, { platform: 'ios', notifications: boundary.api, ownerKey, timezone: 'Asia/Kolkata|-330' });
  assert.deepEqual(cold.scheduledIds, first.scheduledIds); assert.equal(boundary.inventory.size, 1);
  assert.equal(boundary.events.filter(event => event.startsWith('schedule:')).length, 1);
  assert.equal(boundary.inventory.get('new-1').content.data.reminderOwnerKey, ownerKey);
  assert.equal(boundary.inventory.get('new-1').content.data.reminderRevision, 7);
});

for (const mismatched of ['owner', 'revision', 'slot', 'type', 'time', 'timezone', 'repeat'] as const) {
  test(`lost receipt never adopts a native request with mismatched ${mismatched}`, async () => {
    const boundary = expoBoundary(); const ownerKey = 'a'.repeat(64);
    const preferences = { ...requested(), revision: 7, morningTime: '09:20' };
    const first = await syncRecoveryReminders(preferences, { platform: 'ios', notifications: boundary.api, ownerKey, timezone: 'Asia/Kolkata|-330' });
    const native = boundary.inventory.get('new-1');
    if (mismatched === 'owner') native.content.data.reminderOwnerKey = 'b'.repeat(64);
    if (mismatched === 'revision') native.content.data.reminderRevision = 6;
    if (mismatched === 'slot') native.content.data.kind = 'evening';
    if (mismatched === 'type') native.trigger.type = 'unknown';
    if (mismatched === 'time') native.trigger.dateComponents.minute = 25;
    if (mismatched === 'timezone') native.content.data.reminderTimezone = 'Europe/London|0';
    if (mismatched === 'repeat') native.trigger.repeats = false;
    const cold = await syncRecoveryReminders({ ...preferences, scheduledIds: [] }, { platform: 'ios', notifications: boundary.api, ownerKey, timezone: 'Asia/Kolkata|-330' });
    assert.equal(cold.effectiveStatus, 'active'); assert.notDeepEqual(cold.scheduledIds, first.scheduledIds);
    assert.equal(boundary.inventory.get(cold.scheduledIds[0])?.trigger.dateComponents.minute, 20);
  });
}

for (const [field, value] of [['timeZone', 'UTC'], ['second', 30], ['weekdayOrdinal', 2], ['era', 1], ['quarter', 2], ['yearForWeekOfYear', 2026], ['nanosecond', 1], ['isLeapMonth', true], ['isRepeatedDay', true]] as const) {
  test(`native calendar ${field} constraint cannot be adopted as the committed local daily plan`, async () => {
    const boundary = expoBoundary(), ownerKey = 'a'.repeat(64), timezone = 'Asia/Kolkata|-330';
    const preferences = { ...requested(), revision: 7, morningTime: '09:20' };
    const first = await syncRecoveryReminders(preferences, { platform: 'ios', notifications: boundary.api, ownerKey, timezone });
    boundary.inventory.get(first.scheduledIds[0]).trigger.dateComponents[field] = value;
    const cold = await syncRecoveryReminders({ ...preferences, scheduledIds: [] }, { platform: 'ios', notifications: boundary.api, ownerKey, timezone });
    assert.notDeepEqual(cold.scheduledIds, first.scheduledIds); assert.equal(cold.effectiveStatus, 'active');
    assert.equal(boundary.events.filter(event => event.startsWith('schedule:')).length, 2);
  });
}

for (const nativeZone of [null, 'Asia/Kolkata', 'Asia/Calcutta'] as const) {
  test(`serialized local calendar with compatible native timezone ${nativeZone ?? 'unset'} retains its intact daily request`, async () => {
    const boundary = expoBoundary(), ownerKey = 'a'.repeat(64), timezone = 'Asia/Kolkata|-330';
    const preferences = { ...requested(), revision: 7, morningTime: '09:20' };
    const first = await syncRecoveryReminders(preferences, { platform: 'ios', notifications: boundary.api, ownerKey, timezone });
    const native = boundary.inventory.get(first.scheduledIds[0]); native.trigger.class = 'UNCalendarNotificationTrigger';
    native.trigger.dateComponents.timeZone = nativeZone; native.trigger.dateComponents.calendar = null;
    const cold = await syncRecoveryReminders({ ...preferences, scheduledIds: [] }, { platform: 'ios', notifications: boundary.api, ownerKey, timezone });
    assert.deepEqual(cold.scheduledIds, first.scheduledIds); assert.equal(cold.effectiveStatus, 'active');
    assert.equal(boundary.events.filter(event => event.startsWith('schedule:')).length, 1);
  });
}

test('serialized Android daily trigger intrinsically repeats without a repeats field', async () => {
  const boundary = expoBoundary(), ownerKey = 'a'.repeat(64), timezone = 'Asia/Kolkata|-330';
  const read = boundary.api.getAllScheduledNotificationsAsync;
  boundary.api.getAllScheduledNotificationsAsync = async () => (await read()).map(item => ({ ...item, trigger: { type: 'daily', hour: 8, minute: 30, channelId: 'freed-recovery' } }));
  const first = await syncRecoveryReminders(requested(), { platform: 'android', notifications: boundary.api, ownerKey, timezone });
  const cold = await syncRecoveryReminders({ ...requested(), scheduledIds: [] }, { platform: 'android', notifications: boundary.api, ownerKey, timezone });
  assert.equal(cold.effectiveStatus, 'active'); assert.deepEqual(cold.scheduledIds, first.scheduledIds);
  assert.equal(boundary.events.filter(event => event.startsWith('schedule:')).length, 1);
});
