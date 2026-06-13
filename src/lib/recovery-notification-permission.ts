import { Platform } from "react-native";
import {
  getProtectionStatus,
  openAndroidNotificationSettings,
  type ProtectionStatus
} from "freed-protection";

type NotificationPermissionModule = {
  getPermissionsAsync?: () => Promise<{ status?: string }>;
  requestPermissionsAsync?: () => Promise<{ status?: string }>;
};

export async function requestAndroidRecoveryNotificationVisibility(): Promise<ProtectionStatus> {
  const initialStatus = await getProtectionStatus();
  if (Platform.OS !== "android" || initialStatus.androidNotificationPermissionRequired !== true) {
    return withMessage(initialStatus, "Recovery notification permission is not required on this device.");
  }
  if (initialStatus.androidNotificationPermissionGranted !== false) {
    return withMessage(initialStatus, "Recovery notifications are already allowed.");
  }

  let promptStatus: string | null = null;
  try {
    const Notifications = (await import("expo-notifications")) as NotificationPermissionModule;
    promptStatus = await requestRuntimeNotificationPermission(Notifications);
  } catch {
    promptStatus = null;
  }

  const refreshedStatus = await getProtectionStatus();
  if (refreshedStatus.androidNotificationPermissionGranted !== false) {
    return withMessage(refreshedStatus, "Recovery notifications are allowed. DNS Guard can show challenge recovery actions.");
  }

  const settingsStatus = await openAndroidNotificationSettings();
  const suffix = promptStatus ? ` Android permission prompt result: ${promptStatus}.` : "";
  return withMessage(
    settingsStatus,
    `Notifications are still off. FREED opened Android notification settings so you can allow recovery notifications.${suffix}`
  );
}

async function requestRuntimeNotificationPermission(Notifications: NotificationPermissionModule) {
  const current = await Notifications.getPermissionsAsync?.();
  if (current?.status === "granted") return current.status;
  const requested = await Notifications.requestPermissionsAsync?.();
  return requested?.status ?? current?.status ?? "unknown";
}

function withMessage(status: ProtectionStatus, message: string): ProtectionStatus {
  return {
    ...status,
    message
  };
}
