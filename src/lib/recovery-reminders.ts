import {
  generateWeeklyRecoveryReport,
  type RecoveryState,
  type ReminderPermissionStatus,
  type ReminderPreferences
} from "@/lib/recovery-state";

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
  scheduledIds: string[];
  permissionStatus: ReminderPermissionStatus;
  statusMessage: string;
  enabled: boolean;
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

type ReminderNotificationsModule = {
  AndroidImportance?: {
    DEFAULT: unknown;
  };
  SchedulableTriggerInputTypes?: {
    DAILY: unknown;
  };
  cancelScheduledNotificationAsync: (id: string) => Promise<unknown>;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: (options: unknown) => Promise<{ status: string }>;
  scheduleNotificationAsync: (request: unknown) => Promise<string>;
  setNotificationChannelAsync?: (id: string, options: unknown) => Promise<unknown>;
  setNotificationHandler: (handler: unknown) => void;
};

type ReminderSyncOptions = {
  notifications?: ReminderNotificationsModule;
  platform?: "ios" | "android" | "web" | string;
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

export async function syncRecoveryReminders(
  preferences: ReminderPreferences,
  options?: ReminderSyncOptions
): Promise<ReminderSyncResult> {
  const platform = getReminderPlatform(options);
  if (platform !== "ios" && platform !== "android") {
    return {
      scheduledIds: [],
      permissionStatus: "unavailable",
      statusMessage: "Local reminders are available in native iOS and Android builds.",
      enabled: false
    };
  }

  const Notifications = await getNotificationsModule(options);

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });

  await Promise.all(preferences.scheduledIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));

  if (!preferences.enabled) {
    return {
      scheduledIds: [],
      permissionStatus: preferences.permissionStatus,
      statusMessage: "Recovery reminders are off.",
      enabled: false
    };
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") {
    permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
        allowProvisional: true
      }
    });
  }

  if (permission.status !== "granted") {
    return {
      scheduledIds: [],
      permissionStatus: "denied",
      statusMessage: "Notifications are not allowed yet. Enable them to use local recovery reminders.",
      enabled: false
    };
  }

  if (platform === "android") {
    await Notifications.setNotificationChannelAsync?.(REMINDER_CHANNEL_ID, {
      name: "FREED recovery reminders",
      importance: Notifications.AndroidImportance?.DEFAULT ?? "default",
      sound: null,
      enableVibrate: false,
      showBadge: false
    });
  }

  const scheduledIds: string[] = [];
  for (const item of buildReminderPlan(preferences)) {
    const clock = parseClockTime(item.time);
    if (!clock) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: item.title,
        body: item.body,
        sound: false,
        data: { route: "checkin", kind: item.key }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes?.DAILY ?? "daily",
        hour: clock.hour,
        minute: clock.minute,
        channelId: REMINDER_CHANNEL_ID
      }
    });
    scheduledIds.push(id);
  }

  return {
    scheduledIds,
    permissionStatus: "granted",
    statusMessage: `${scheduledIds.length} local recovery reminder${scheduledIds.length === 1 ? "" : "s"} scheduled.`,
    enabled: scheduledIds.length > 0
  };
}
