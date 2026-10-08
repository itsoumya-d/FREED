import assert from "node:assert/strict";
import test from "node:test";
import {
  getReminderSyncFailureResult,
  syncRecoveryReminders,
  type ReminderSyncResult
} from "../src/lib/recovery-reminders";
import {
  createDefaultRecoveryState,
  recordReminderSync,
  updateReminderPreferences,
  type RecoveryState,
  type ReminderPreferences
} from "../src/lib/recovery-state";

function createNotifications(initialIds: string[] = []) {
  const active = new Set(initialIds);
  const cancelled: string[] = [];
  const requests: unknown[] = [];
  const failCancellation = new Set<string>();
  let scheduleCalls = 0;
  const controls = {
    failScheduleAt: 0,
    failHandler: false,
    failPermissions: false,
    failPermissionRequest: false,
    failChannel: false,
    permission: "granted",
    permissionRequests: 0,
    channelCalls: 0
  };
  const notifications = {
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DAILY: "daily" },
    setNotificationHandler() {
      if (controls.failHandler) throw new Error("synthetic handler failure");
    },
    async getPermissionsAsync() {
      if (controls.failPermissions) throw new Error("synthetic permission failure");
      return { status: controls.permission };
    },
    async requestPermissionsAsync() {
      controls.permissionRequests++;
      if (controls.failPermissionRequest) throw new Error("synthetic permission request failure");
      return { status: controls.permission };
    },
    // Deliberately not async: thrown provider errors must be retained too.
    cancelScheduledNotificationAsync(id: string) {
      cancelled.push(id);
      if (failCancellation.has(id)) throw new Error("synthetic cancellation failure");
      active.delete(id);
      return Promise.resolve();
    },
    async scheduleNotificationAsync(request: unknown) {
      scheduleCalls++;
      if (scheduleCalls === controls.failScheduleAt) throw new Error("synthetic scheduling failure");
      const id = `synthetic-${scheduleCalls}`;
      active.add(id);
      requests.push(request);
      return id;
    },
    async setNotificationChannelAsync() {
      controls.channelCalls++;
      if (controls.failChannel) throw new Error("synthetic channel failure");
    }
  };
  return { active, cancelled, requests, failCancellation, controls, notifications };
}

type FakeNotifications = ReturnType<typeof createNotifications>;

function enabledState(): RecoveryState {
  return updateReminderPreferences(createDefaultRecoveryState(), {
    enabled: true,
    eveningEnabled: false,
    guardTime: "23:00"
  });
}

// Use the same production state transitions as changeReminderPreferences, so a
// retained ID must also survive recordReminderSync and state hydration.
async function syncAndRecord(
  state: RecoveryState,
  update: Partial<ReminderPreferences>,
  fake: FakeNotifications,
  platform = "ios"
): Promise<RecoveryState> {
  const nextPreferences = { ...state.reminders, ...update };
  let result: ReminderSyncResult;
  try {
    result = await syncRecoveryReminders(nextPreferences, { platform, notifications: fake.notifications });
  } catch (error) {
    result = getReminderSyncFailureResult(error, nextPreferences);
  }
  return recordReminderSync(updateReminderPreferences(state, update), result);
}

function assertTracked(state: RecoveryState, fake: FakeNotifications) {
  assert.deepEqual([...state.reminders.scheduledIds].sort(), [...fake.active].sort());
}

test("later scheduling failure rolls back and retry then disable leaves no duplicates", async () => {
  const fake = createNotifications();
  fake.controls.failScheduleAt = 2;
  let state = await syncAndRecord(enabledState(), {}, fake);
  assertTracked(state, fake);
  assert.deepEqual(fake.cancelled, ["synthetic-1"]);
  assert.equal(fake.active.size, 0);
  assert.equal(state.reminders.enabled, false);
  assert.equal(state.reminders.permissionStatus, "granted");
  assert.match(state.reminders.statusMessage, /could not be synced/);

  fake.controls.failScheduleAt = 0;
  state = await syncAndRecord(state, { enabled: true }, fake);
  assertTracked(state, fake);
  assert.equal(fake.active.size, 2);
  state = await syncAndRecord(state, { enabled: false }, fake);
  assertTracked(state, fake);
  assert.equal(fake.active.size, 0);
  assert.equal(state.reminders.enabled, false);
  assert.equal(state.reminders.statusMessage, "Recovery reminders are off.");
});

test("first scheduling failure has nothing to roll back", async () => {
  const fake = createNotifications();
  fake.controls.failScheduleAt = 1;
  const state = await syncAndRecord(enabledState(), {}, fake);
  assertTracked(state, fake);
  assert.deepEqual(fake.cancelled, []);
  assert.equal(state.reminders.enabled, false);
  assert.equal(state.reminders.permissionStatus, "granted");
});

test("rollback failures retain only unresolved IDs and retry cleanup before rescheduling", async () => {
  const fake = createNotifications();
  fake.controls.failScheduleAt = 3;
  fake.failCancellation.add("synthetic-1");
  let state = await syncAndRecord(enabledState(), { eveningEnabled: true }, fake);
  assert.deepEqual(fake.cancelled, ["synthetic-1", "synthetic-2"]);
  assertTracked(state, fake);
  assert.deepEqual(state.reminders.scheduledIds, ["synthetic-1"]);
  assert.equal(state.reminders.enabled, true);
  assert.equal(state.reminders.permissionStatus, "granted");
  assert.match(state.reminders.statusMessage, /may still be active/);

  // A failed cleanup must not schedule any replacement or claim to be off.
  state = await syncAndRecord(state, { enabled: false }, fake);
  assertTracked(state, fake);
  assert.equal(fake.requests.length, 2);
  assert.equal(state.reminders.enabled, true);
  assert.doesNotMatch(state.reminders.statusMessage, /are off/);
  state = await syncAndRecord(state, { enabled: true }, fake);
  assertTracked(state, fake);
  assert.equal(fake.requests.length, 2);

  fake.failCancellation.clear();
  fake.controls.failScheduleAt = 0;
  state = await syncAndRecord(state, { enabled: true }, fake);
  assertTracked(state, fake);
  assert.equal(fake.active.size, 3);
  assert.ok(!fake.active.has("synthetic-1"));
  state = await syncAndRecord(state, { enabled: false }, fake);
  assertTracked(state, fake);
  assert.equal(fake.active.size, 0);
  assert.equal(state.reminders.enabled, false);
});

test("failed rollback can be recovered directly by disabling reminders", async () => {
  const fake = createNotifications();
  fake.controls.failScheduleAt = 2;
  fake.failCancellation.add("synthetic-1");
  let state = await syncAndRecord(enabledState(), {}, fake);
  fake.failCancellation.clear();
  state = await syncAndRecord(state, { enabled: false }, fake);
  assertTracked(state, fake);
  assert.equal(fake.active.size, 0);
  assert.equal(state.reminders.enabled, false);
});

test("old reminder cancellation failures prevent replacement and preserve remaining IDs", async () => {
  const fake = createNotifications(["old-morning", "old-guard"]);
  fake.failCancellation.add("old-guard");
  const state = await syncAndRecord(enabledState(), {
    scheduledIds: ["old-morning", "old-guard"], permissionStatus: "granted"
  }, fake);
  assertTracked(state, fake);
  assert.deepEqual(state.reminders.scheduledIds, ["old-guard"]);
  assert.equal(fake.requests.length, 0);
  assert.equal(state.reminders.enabled, true);
});

test("normal Android success keeps privacy-safe payloads and cancels old IDs", async () => {
  const fake = createNotifications(["old-morning", "old-guard"]);
  const state = await syncAndRecord(enabledState(), { scheduledIds: ["old-morning", "old-guard"] }, fake, "android");
  assertTracked(state, fake);
  assert.deepEqual(fake.cancelled, ["old-morning", "old-guard"]);
  assert.equal(fake.controls.channelCalls, 1);
  assert.equal(state.reminders.permissionStatus, "granted");
  assert.equal(state.reminders.enabled, true);
  assert.equal(state.reminders.statusMessage, "2 local recovery reminders scheduled.");
  const requests = fake.requests as Array<{ content: { data: unknown }; trigger: unknown }>;
  assert.deepEqual(requests.map((request) => request.content.data), [
    { route: "checkin", kind: "morning" }, { route: "checkin", kind: "guard" }
  ]);
  assert.deepEqual(requests.map((request) => request.trigger), [
    { type: "daily", hour: 8, minute: 30, channelId: "freed-recovery" },
    { type: "daily", hour: 23, minute: 0, channelId: "freed-recovery" }
  ]);
  assert.doesNotMatch(JSON.stringify(requests), /streakDays|attempts|relapseRecords|reflection|private|token|url/i);
});

test("denied permission cleans up old reminders without scheduling new ones", async () => {
  const fake = createNotifications(["old"]);
  fake.controls.permission = "denied";
  const state = await syncAndRecord(enabledState(), { scheduledIds: ["old"] }, fake);
  assertTracked(state, fake);
  assert.equal(state.reminders.permissionStatus, "denied");
  assert.equal(state.reminders.enabled, false);
  assert.equal(fake.controls.permissionRequests, 1);
  assert.equal(fake.requests.length, 0);
});

for (const failure of ["failPermissions", "failPermissionRequest", "failChannel"] as const) {
  test(`${failure} after cleanup does not resurrect canceled IDs`, async () => {
    const fake = createNotifications(["old"]);
    fake.controls[failure] = true;
    if (failure === "failPermissionRequest") fake.controls.permission = "undetermined";
    const state = await syncAndRecord(enabledState(), { scheduledIds: ["old"] }, fake, "android");
    assertTracked(state, fake);
    assert.equal(fake.active.size, 0);
    assert.equal(state.reminders.enabled, false);
    assert.equal(fake.requests.length, 0);
  });
}

test("failure before cleanup conservatively keeps known reminder IDs", async () => {
  const fake = createNotifications(["old"]);
  fake.controls.failHandler = true;
  const state = await syncAndRecord(enabledState(), { scheduledIds: ["old"], permissionStatus: "granted" }, fake);
  assertTracked(state, fake);
  assert.equal(state.reminders.enabled, true);
  assert.equal(state.reminders.permissionStatus, "granted");
  assert.match(state.reminders.statusMessage, /may still be active/);
});

test("unknown caller failures preserve IDs and never expose raw native errors", () => {
  const preferences = { ...enabledState().reminders, scheduledIds: ["old"], permissionStatus: "granted" as const };
  const result = getReminderSyncFailureResult(new Error("synthetic-private-detail"), preferences);
  assert.deepEqual(result.scheduledIds, ["old"]);
  assert.equal(result.enabled, true);
  assert.equal(result.permissionStatus, "granted");
  assert.doesNotMatch(result.statusMessage, /synthetic-private-detail/);
});

test("non-native sync keeps cancellation IDs without contacting native APIs", async () => {
  const fake = createNotifications(["old"]);
  let state = await syncAndRecord(enabledState(), { scheduledIds: ["old"] }, fake, "web");
  assertTracked(state, fake);
  assert.equal(state.reminders.permissionStatus, "unavailable");
  assert.equal(state.reminders.enabled, true);
  assert.deepEqual(fake.cancelled, []);
  assert.equal(fake.requests.length, 0);
  assert.match(state.reminders.statusMessage, /may still be active/);
  state = await syncAndRecord(state, { enabled: false }, fake);
  assertTracked(state, fake);
  assert.equal(fake.active.size, 0);
});

test("empty reminder plan succeeds without scheduling anything", async () => {
  const fake = createNotifications();
  const state = await syncAndRecord(enabledState(), { morningEnabled: false, guardEnabled: false }, fake);
  assertTracked(state, fake);
  assert.equal(state.reminders.enabled, false);
  assert.equal(fake.active.size, 0);
});

test("all asynchronously rejected rollback IDs remain recoverable on disable", async () => {
  const fake = createNotifications();
  const cancel = fake.notifications.cancelScheduledNotificationAsync;
  fake.notifications.cancelScheduledNotificationAsync = async (id: string) => {
    fake.cancelled.push(id);
    throw new Error("synthetic asynchronous cancellation failure");
  };
  fake.controls.failScheduleAt = 3;
  let state = await syncAndRecord(enabledState(), { eveningEnabled: true }, fake);
  assertTracked(state, fake);
  assert.deepEqual(state.reminders.scheduledIds, ["synthetic-1", "synthetic-2"]);
  assert.equal(state.reminders.enabled, true);
  assert.deepEqual(fake.cancelled, ["synthetic-1", "synthetic-2"]);
  fake.notifications.cancelScheduledNotificationAsync = cancel;
  state = await syncAndRecord(state, { enabled: false }, fake);
  assertTracked(state, fake);
  assert.equal(fake.active.size, 0);
  assert.equal(state.reminders.enabled, false);
});

test("permission request failure retains the latest observed denial", async () => {
  const fake = createNotifications(["old"]);
  fake.controls.permission = "denied";
  fake.controls.failPermissionRequest = true;
  const state = await syncAndRecord(enabledState(), {
    scheduledIds: ["old"], permissionStatus: "granted"
  }, fake);
  assertTracked(state, fake);
  assert.equal(state.reminders.permissionStatus, "denied");
  assert.equal(state.reminders.enabled, false);
  assert.equal(fake.active.size, 0);
});

test("cleanup failures do not advance the last successful scheduling timestamp", async () => {
  const fake = createNotifications(["old"]);
  fake.failCancellation.add("old");
  const lastScheduledAt = "2026-10-01T12:00:00.000Z";
  const previous = recordReminderSync(enabledState(), {
    scheduledIds: ["old"], permissionStatus: "granted", statusMessage: "Previously scheduled.", enabled: true
  }, lastScheduledAt);
  const failed = await syncAndRecord(previous, { enabled: false }, fake);
  assertTracked(failed, fake);
  assert.equal(failed.reminders.lastScheduledAt, lastScheduledAt);
  assert.notEqual(failed.reminders.updatedAt, lastScheduledAt);
  const unsupported = await syncAndRecord(previous, {}, fake, "web");
  assert.equal(unsupported.reminders.lastScheduledAt, lastScheduledAt);

  fake.failCancellation.clear();
  const success = await syncAndRecord(failed, { enabled: true }, fake);
  assert.equal(success.reminders.lastScheduledAt, success.reminders.updatedAt);
  assert.notEqual(success.reminders.lastScheduledAt, lastScheduledAt);
});
