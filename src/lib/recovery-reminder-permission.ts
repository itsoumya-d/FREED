import type { ReminderPermissionStatus } from '@/lib/recovery-state';

/** Expo's iOS authorization field is authoritative; general status can be undetermined for provisional. */
export type ReminderPermissionResponse = {
  status?: string;
  granted?: boolean;
  canAskAgain?: boolean;
  expires?: string | number;
  ios?: { status?: number | string; [key: string]: unknown };
};

export function normalizeReminderPermission(response: ReminderPermissionResponse | null | undefined, platform: string | undefined): ReminderPermissionStatus {
  if (platform !== 'ios' && platform !== 'android') return 'unsupported';
  if (platform === 'ios' && response?.ios?.status !== undefined) {
    const statuses: Record<string, ReminderPermissionStatus> = {
      '0': 'undetermined', '1': 'denied', '2': 'authorized', '3': 'provisional', '4': 'ephemeral',
      not_determined: 'undetermined', undetermined: 'undetermined', denied: 'denied', authorized: 'authorized', provisional: 'provisional', ephemeral: 'ephemeral'
    };
    const native = statuses[String(response.ios.status).toLowerCase()];
    if (native) return native;
  }
  if (response?.status === 'granted') return 'authorized';
  if (response?.status === 'denied') return 'denied';
  return 'undetermined';
}

export function reminderPermissionAllowsScheduling(permission: ReminderPermissionStatus): boolean {
  return permission === 'authorized' || permission === 'provisional' || permission === 'ephemeral';
}
