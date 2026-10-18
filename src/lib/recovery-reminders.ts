import {
  generateWeeklyRecoveryReport,
  type RecoveryState,
  type ReminderPermissionStatus,
  type ReminderEffectiveStatus,
  type ReminderPreferences
} from "@/lib/recovery-state";

import { normalizeReminderPermission, reminderPermissionAllowsScheduling, type ReminderPermissionResponse } from "@/lib/recovery-reminder-permission";

const REMINDER_CHANNEL_ID = "freed-recovery";

export type ReminderPlanItem = {
  key: "morning" | "evening" | "guard";
  title: string;
  body: string;
  time: string;
};

export type SmartReminderSuggestion = {
  guardTime: string;
  source: "risk-window" | "slip-window" | "default";
  confidence: "low" | "medium" | "high";
  reason: string;
  shouldApply: boolean;
};

export type ReminderSyncResult = {
  contractVersion: 2;
  revision: number;
  scheduledIds: string[];
  permissionStatus: ReminderPermissionStatus;
  effectiveStatus: ReminderEffectiveStatus;
  timezone: string | null;
  statusMessage: string;
  /** Requested intention echoed for callers; never a scheduling-success flag. */
  enabled: boolean;
  stale?: boolean;
};

export type ReminderTestResult = {
  status: "sent" | "permission-required" | "unsupported" | "failed" | "stale";
  permissionStatus: ReminderPermissionStatus;
  statusMessage: string;
};

export type ReminderRoute = "checkin";

type ReminderNotificationResponse = {
  notification?: {
    request?: {
      content?: {
        data?: unknown;
      };
    };
  };
};

export type ScheduledReminderNotification = {
  identifier: string;
  content: { title?: string | null; data?: unknown };
  trigger?: unknown;
};

export type ReminderNotificationsModule = {
  AndroidImportance?: { DEFAULT: unknown };
  SchedulableTriggerInputTypes?: { DAILY: unknown };
  cancelScheduledNotificationAsync: (id: string) => Promise<unknown>;
  getPermissionsAsync: () => Promise<ReminderPermissionResponse>;
  requestPermissionsAsync: (options: unknown) => Promise<ReminderPermissionResponse>;
  getAllScheduledNotificationsAsync: () => Promise<ScheduledReminderNotification[]>;
  scheduleNotificationAsync: (request: unknown) => Promise<string>;
  setNotificationChannelAsync?: (id: string, options: unknown) => Promise<unknown>;
  setNotificationHandler: (handler: unknown) => void;
};

export type ReminderSyncOptions = {
  notifications?: ReminderNotificationsModule;
  platform?: "ios" | "android" | "web" | string;
  requestPermission?: boolean;
  timezone?: string;
  forceReplace?: boolean;
  /** Stable opaque owner key, never a UID. The preference revision was durably committed before use. */
  ownerKey?: string;
  isCurrent?: () => boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseClockTime(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

export function getReminderRouteFromData(data: unknown): ReminderRoute | null {
  if (!isRecord(data)) return null;
  return data.route === "checkin" ? "checkin" : null;
}

export function getReminderRouteFromResponse(response: ReminderNotificationResponse | null | undefined): ReminderRoute | null {
  return getReminderRouteFromData(response?.notification?.request?.content?.data);
}

const smartGuardTimes: Record<string, { time: string; label: string }> = {
  Morning: { time: "07:30", label: "morning risk" },
  Afternoon: { time: "14:30", label: "afternoon risk" },
  Evening: { time: "20:30", label: "evening risk" },
  "Late night": { time: "23:00", label: "late-night risk" }
};

function getSmartGuardWindow(label: string) {
  return smartGuardTimes[label] ?? null;
}

export function getSmartReminderSuggestion(state: RecoveryState, currentGuardTime = state.reminders.guardTime): SmartReminderSuggestion {
  const weeklyReport = generateWeeklyRecoveryReport(state);
  const slipWindow = getSmartGuardWindow(weeklyReport.slipWindow);
  const riskWindow = getSmartGuardWindow(weeklyReport.riskWindow);
  const selected = slipWindow ? { ...slipWindow, source: "slip-window" as const, confidence: "high" as const } : riskWindow ? { ...riskWindow, source: "risk-window" as const, confidence: "medium" as const } : null;

  if (!selected) {
    return {
      guardTime: currentGuardTime,
      source: "default",
      confidence: "low",
      reason: "No clear risk window yet. Keep the gentle guard reminder where it is.",
      shouldApply: false
    };
  }

  return {
    guardTime: selected.time,
    source: selected.source,
    confidence: selected.confidence,
    reason: `Smart guard uses your ${selected.label} pattern and checks in just before that window.`,
    shouldApply: currentGuardTime !== selected.time
  };
}

export async function listenForReminderResponses(onRoute: (route: ReminderRoute) => void): Promise<() => void> {
  if (process.env.EXPO_OS !== "ios" && process.env.EXPO_OS !== "android") {
    return () => undefined;
  }

  const Notifications = await import("expo-notifications");

  const handleResponse = (response: ReminderNotificationResponse | null | undefined) => {
    const route = getReminderRouteFromResponse(response);
    if (!route) return;
    onRoute(route);
    Notifications.clearLastNotificationResponse();
  };

  handleResponse(Notifications.getLastNotificationResponse());
  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

  return () => subscription.remove();
}

export function buildReminderPlan(preferences: ReminderPreferences): ReminderPlanItem[] {
  if (!preferences.enabled) return [];

  const plan: ReminderPlanItem[] = [];

  if (preferences.morningEnabled && parseClockTime(preferences.morningTime)) {
    plan.push({
      key: "morning",
      title: "FREED morning reset",
      body: "One minute. Set the tone before the day starts moving.",
      time: preferences.morningTime
    });
  }

  if (preferences.eveningEnabled && parseClockTime(preferences.eveningTime)) {
    plan.push({
      key: "evening",
      title: "FREED evening reflection",
      body: "Check in, lower stimulation, and make tonight easier.",
      time: preferences.eveningTime
    });
  }

  if (preferences.guardEnabled && parseClockTime(preferences.guardTime)) {
    plan.push({
      key: "guard",
      title: "FREED night guard",
      body: "Phone away, lights low, one clean choice at a time.",
      time: preferences.guardTime
    });
  }

  return plan;
}

async function getNotificationsModule(options?: ReminderSyncOptions): Promise<ReminderNotificationsModule> {
  if (options?.notifications) return options.notifications;
  return (await import("expo-notifications")) as unknown as ReminderNotificationsModule;
}

function getReminderPlatform(options?: ReminderSyncOptions) {
  return options?.platform ?? process.env.EXPO_OS;
}

// One device-level queue covers reads, replacements, cleanup and explicit tests across hook remounts.
let deviceReminderQueue: Promise<unknown> = Promise.resolve();
function serializeReminderOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = deviceReminderQueue.then(operation, operation);
  deviceReminderQueue = result.catch(() => undefined);
  return result;
}

const reminderTitles: Record<string, string> = {
  morning: "FREED morning reset", evening: "FREED evening reflection", guard: "FREED night guard"
};
function isOwnedReminder(request: ScheduledReminderNotification): boolean {
  const data = request.content?.data;
  if (!isRecord(data) || data.route !== "checkin") return false;
  if (data.freedReminderVersion === 2 && ["morning", "evening", "guard", "test"].includes(String(data.kind))) return true;
  // Legacy ownership needs both the exact app title and route/kind, not a saved ID alone.
  return request.content.title === reminderTitles[String(data.kind)] && Object.hasOwn(reminderTitles, String(data.kind));
}
function canonicalTimezone(zone: string): string | null {
  try { return new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone; }
  catch { return null; }
}
function readTriggerClock(trigger: unknown, timezone: string) {
  if (!isRecord(trigger)) return null;
  let clock: Record<string, unknown>;
  if (trigger.type === "daily") {
    // Android's serialized DailyTrigger intrinsically repeats; it does not have a repeats field.
    const allowed = new Set(["type", "hour", "minute", "channelId", "repeats"]);
    if (Object.keys(trigger).some(key => !allowed.has(key) && trigger[key] != null) || (trigger.repeats !== undefined && trigger.repeats !== true)) return null;
    clock = trigger;
  } else {
    if (trigger.type !== "calendar" || trigger.repeats !== true || !isRecord(trigger.dateComponents)) return null;
    if (trigger.class != null && trigger.class !== "UNCalendarNotificationTrigger") return null;
    if (trigger.seconds != null || trigger.region != null) return null;
    clock = trigger.dateComponents;
    const allowed = new Set(["hour", "minute", "calendar", "timeZone", "isLeapMonth", "isRepeatedDay"]);
    // Expo DailyTriggerRecord supplies only hour/minute. Extra date, weekday or seconds constrain recurrence.
    if (Object.keys(clock).some(key => !allowed.has(key) && clock[key] != null)) return null;
    if (clock.isLeapMonth !== undefined && clock.isLeapMonth !== false) return null;
    if (clock.isRepeatedDay !== undefined && clock.isRepeatedDay !== false) return null;
    if (clock.calendar != null && clock.calendar !== "gregorian" && clock.calendar !== "iso8601") return null;
    if (clock.timeZone != null) {
      if (typeof clock.timeZone !== "string") return null;
      const expected = canonicalTimezone(timezone.split('|')[0]);
      const actual = canonicalTimezone(clock.timeZone);
      if (!actual || !expected || actual !== expected) return null;
    }
  }
  return typeof clock.hour === "number" && typeof clock.minute === "number" ? { hour: clock.hour, minute: clock.minute } : null;
}

function matchesPlan(request: ScheduledReminderNotification, item: ReminderPlanItem, timezone: string, ownerKey?: string, revision?: number) {
  const data = request.content?.data;
  const clock = readTriggerClock(request.trigger, timezone);
  const wanted = parseClockTime(item.time);
  return isRecord(data) && data.freedReminderVersion === 2 && data.kind === item.key && data.reminderTimezone === timezone
    && (ownerKey === undefined || (data.reminderOwnerKey === ownerKey && data.reminderRevision === revision))
    && clock?.hour === wanted?.hour && clock?.minute === wanted?.minute;
}
export function getReminderTimezone(): string {
  try { return `${Intl.DateTimeFormat().resolvedOptions().timeZone}|${new Date().getTimezoneOffset()}`; }
  catch { return `local|${new Date().getTimezoneOffset()}`; }
}
async function observePermission(notifications: ReminderNotificationsModule, platform: string, requestPermission: boolean) {
  let permission = normalizeReminderPermission(await notifications.getPermissionsAsync(), platform);
  if (requestPermission && permission === "undetermined") {
    permission = normalizeReminderPermission(await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false, allowProvisional: true } }), platform);
  }
  return permission;
}
async function configureNotifications(notifications: ReminderNotificationsModule, platform: string) {
  notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
  if (platform === "android") await notifications.setNotificationChannelAsync?.(REMINDER_CHANNEL_ID, {
    name: "FREED recovery reminders", importance: notifications.AndroidImportance?.DEFAULT ?? "default", sound: null, enableVibrate: false, showBadge: false
  });
}

export function syncRecoveryReminders(preferences: ReminderPreferences, options?: ReminderSyncOptions): Promise<ReminderSyncResult> {
  return serializeReminderOperation(async () => {
    const platform = getReminderPlatform(options);
    const timezone = options?.timezone ?? getReminderTimezone();
    const current = () => options?.isCurrent?.() !== false;
    let permissionStatus = preferences.permissionStatus;
    let preservedIds = [...preferences.scheduledIds];
    const createdIds: string[] = [];
    let replacementVerified = false;
    const result = (effectiveStatus: ReminderEffectiveStatus, statusMessage: string, ids = preservedIds, stale = false): ReminderSyncResult => ({
      contractVersion: 2, revision: preferences.revision, enabled: preferences.enabled, effectiveStatus, permissionStatus, statusMessage, timezone, scheduledIds: ids, ...(stale ? { stale: true } : {})
    });
    if (!current()) return result("pending", "Checking recovery reminders on this device.", preservedIds, true);
    if (platform !== "ios" && platform !== "android") {
      permissionStatus = "unsupported";
      return result(preferences.enabled ? "permission-required" : "off", "Local reminders are available in native iOS and Android builds.", []);
    }
    let notifications: ReminderNotificationsModule | undefined;
    const cleanupCreated = async () => {
      // Only this transaction's new IDs are eligible, including after a superseding intent.
      const remaining: string[] = [];
      for (const id of createdIds) {
        try { await notifications!.cancelScheduledNotificationAsync(id); } catch { remaining.push(id); }
      }
      return remaining;
    };
    try {
      notifications = await getNotificationsModule(options);
      if (!current()) return result("pending", "Checking recovery reminders on this device.", preservedIds, true);
      const inventory = await notifications.getAllScheduledNotificationsAsync();
      const owned = inventory.filter(isOwnedReminder);
      preservedIds = owned.map(request => request.identifier);
      if (!current()) return result("pending", "Checking recovery reminders on this device.", preservedIds, true);
      const plan = buildReminderPlan(preferences);
      if (!preferences.enabled || !plan.length) {
        for (const request of owned) {
          if (!current()) return result("pending", "Checking recovery reminders on this device.", preservedIds, true);
          await notifications.cancelScheduledNotificationAsync(request.identifier);
        }
        const remaining = (await notifications.getAllScheduledNotificationsAsync()).filter(isOwnedReminder);
        if (!current()) return result("pending", "Checking recovery reminders on this device.", remaining.map(item => item.identifier), true);
        if (remaining.length) return result("failed", "Some recovery reminders could not be removed. Retry to finish turning them off.", remaining.map(item => item.identifier));
        return result("off", preferences.enabled ? "No recovery reminder times are enabled." : "Recovery reminders are off.", []);
      }
      permissionStatus = await observePermission(notifications, platform, options?.requestPermission === true);
      if (!current()) return result("pending", "Checking recovery reminders on this device.", preservedIds, true);
      if (!reminderPermissionAllowsScheduling(permissionStatus)) return result("permission-required", "Notifications are not allowed yet. Open settings to allow recovery reminders.");
      const successResult = (ids: string[]) => result(permissionStatus === "provisional" ? "quiet" : "active",
        permissionStatus === "provisional" ? "Recovery reminders are scheduled quietly in Notification Center." : `${plan.length} local recovery reminder${plan.length === 1 ? "" : "s"} scheduled.`, ids);
      await configureNotifications(notifications, platform);
      if (!current()) return result("pending", "Checking recovery reminders on this device.", preservedIds, true);
      // A lost receipt may be recovered only from native metadata matching already committed intention.
      const existing = owned.filter(request => preferences.scheduledIds.includes(request.identifier)
        || (options?.ownerKey !== undefined && plan.some(item => matchesPlan(request, item, timezone, options.ownerKey, preferences.revision))));
      if (!options?.forceReplace && existing.length === plan.length && owned.length === plan.length
        && plan.every(item => existing.some(request => matchesPlan(request, item, timezone, options?.ownerKey, preferences.revision)))) {
        return successResult(existing.map(request => request.identifier));
      }
      for (const item of plan) {
        if (!current()) return result("pending", "Checking recovery reminders on this device.", [...preservedIds, ...await cleanupCreated()], true);
        const clock = parseClockTime(item.time)!;
        const id = await notifications.scheduleNotificationAsync({
          content: { title: item.title, body: item.body, sound: false, data: { route: "checkin", kind: item.key, freedReminderVersion: 2, reminderTimezone: timezone, ...(options?.ownerKey ? { reminderOwnerKey: options.ownerKey, reminderRevision: preferences.revision } : {}) } },
          trigger: { type: notifications.SchedulableTriggerInputTypes?.DAILY ?? "daily", hour: clock.hour, minute: clock.minute, channelId: REMINDER_CHANNEL_ID }
        });
        createdIds.push(id);
      }
      const readback = await notifications.getAllScheduledNotificationsAsync();
      if (!current()) return result("pending", "Checking recovery reminders on this device.", [...preservedIds, ...await cleanupCreated()], true);
      if (!plan.every((item, index) => readback.some(request => request.identifier === createdIds[index] && isOwnedReminder(request) && matchesPlan(request, item, timezone, options?.ownerKey, preferences.revision)))) throw new Error("Reminder readback did not match the requested schedule.");
      permissionStatus = await observePermission(notifications, platform, false);
      if (!current()) return result("pending", "Checking recovery reminders on this device.", [...preservedIds, ...await cleanupCreated()], true);
      if (!reminderPermissionAllowsScheduling(permissionStatus)) return result("permission-required", "Notifications are not allowed yet. Open settings to allow recovery reminders.", [...preservedIds, ...await cleanupCreated()]);
      replacementVerified = true;
      // Replacement authority is established before any working old schedule is removed.
      for (const id of preservedIds) {
        if (!current()) return result("pending", "Checking recovery reminders on this device.", [...preservedIds, ...await cleanupCreated()], true);
        await notifications.cancelScheduledNotificationAsync(id);
      }
      const confirmed = await notifications.getAllScheduledNotificationsAsync();
      if (!current()) return result("pending", "Checking recovery reminders on this device.", createdIds, true);
      const remainingOld = confirmed.filter(request => isOwnedReminder(request) && preservedIds.includes(request.identifier));
      if (remainingOld.length) return result("failed", "Reminder replacement needs repair. Retry to remove the previous schedule.", [...createdIds, ...remainingOld.map(item => item.identifier)]);
      if (!createdIds.every(id => confirmed.some(request => request.identifier === id))) throw new Error("Scheduled reminders were not retained.");
      permissionStatus = await observePermission(notifications, platform, false);
      if (!current()) return result("pending", "Checking recovery reminders on this device.", createdIds, true);
      if (!reminderPermissionAllowsScheduling(permissionStatus)) return result("permission-required", "Notifications are not allowed yet. Open settings to allow recovery reminders.", createdIds);
      return successResult(createdIds);
    } catch {
      // Once readback verifies the replacement, failed old cleanup must retain the working new schedule.
      const remainingCreated = replacementVerified ? createdIds : notifications ? await cleanupCreated() : [];
      return result("failed", "Recovery reminders could not be scheduled. Your times are saved. Retry to repair reminders.", [...preservedIds, ...remainingCreated], !current());
    }
  });
}

/** Called only from an explicit UI test action; never from reconcile, hydration, or permission reads. */
export function sendRecoveryTestNotification(options?: ReminderSyncOptions): Promise<ReminderTestResult> {
  return serializeReminderOperation(async () => {
    const platform = getReminderPlatform(options);
    let permissionStatus: ReminderPermissionStatus = "undetermined";
    const result = (status: ReminderTestResult["status"], statusMessage: string): ReminderTestResult => ({ status, permissionStatus, statusMessage });
    const current = () => options?.isCurrent?.() !== false;
    if (!current()) return result("stale", "The reminder test was cancelled because the account changed.");
    if (platform !== "ios" && platform !== "android") { permissionStatus = "unsupported"; return result("unsupported", "Local reminders are available in native iOS and Android builds."); }
    let id: string | undefined;
    let notifications: ReminderNotificationsModule | undefined;
    try {
      notifications = await getNotificationsModule(options);
      permissionStatus = await observePermission(notifications, platform, true);
      if (!current()) return result("stale", "The reminder test was cancelled because the account changed.");
      if (!reminderPermissionAllowsScheduling(permissionStatus)) return result("permission-required", "Open notification settings to allow recovery reminders.");
      await configureNotifications(notifications, platform);
      if (!current()) return result("stale", "The reminder test was cancelled because the account changed.");
      id = await notifications.scheduleNotificationAsync({ content: { title: "FREED reminder test", body: "Your recovery reminder test is ready.", sound: false, data: { route: "checkin", kind: "test", freedReminderVersion: 2 } }, trigger: null });
      if (!current()) { await notifications.cancelScheduledNotificationAsync(id); return result("stale", "The reminder test was cancelled because the account changed."); }
      return result("sent", permissionStatus === "provisional" ? "Test sent quietly. Check Notification Center." : "Test notification sent.");
    } catch {
      if (id && notifications) await notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
      return result("failed", "The test notification could not be sent. Retry to repair reminders.");
    }
  });
}
