import type { DisciplineSettings } from './recovery-state';
import { DOOMSCROLL_APP_OPTIONS, SUPPORTED_DOOMSCROLL_APP_PACKAGES, expandDoomscrollAppPackages } from './doomscroll-apps';

export type AppSchedule = {
  id: 'sleep' | 'work' | 'weekend';
  enabled: boolean;
  startMinute: number;
  endMinute: number;
  /** Local start days, Sunday = 0. Overnight windows belong to their start day. */
  days: number[];
  packages: string[];
  allDay?: boolean;
};
export type AppScheduleConfiguration = { version: 1; schedules: AppSchedule[]; targetScope?: 'selected-applications'; strictGuard?: boolean };

const ids = new Set(['sleep', 'work', 'weekend']);
const supported = new Set<string>(SUPPORTED_DOOMSCROLL_APP_PACKAGES);
const minute = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1440;
function clockMinute(value: string) {
  const parts = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return parts ? Number(parts[1]) * 60 + Number(parts[2]) : null;
}

/** Validate atomically; malformed updates must never be interpreted as a clear. */
export function sanitizeAppScheduleConfiguration(value: unknown): AppScheduleConfiguration | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || !Array.isArray(input.schedules) || input.schedules.length > 3) return null;
  if ('targetScope' in input && input.targetScope !== 'selected-applications') return null;
  if ('strictGuard' in input && typeof input.strictGuard !== 'boolean') return null;
  const selectedApplications = input.targetScope === 'selected-applications';
  const seen = new Set<string>();
  const schedules: AppSchedule[] = [];
  for (const raw of input.schedules) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !ids.has(item.id) || seen.has(item.id) || typeof item.enabled !== 'boolean' || !minute(item.startMinute) || !minute(item.endMinute)) return null;
    if (!Array.isArray(item.days) || item.days.some(day => typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6)) return null;
    if (!Array.isArray(item.packages) || item.packages.some(pkg => typeof pkg !== 'string' || !supported.has(pkg.trim().toLowerCase()))) return null;
    if (selectedApplications && item.packages.length !== 0) return null;
    if (item.allDay !== undefined && typeof item.allDay !== 'boolean') return null;
    const days = [...new Set(item.days as number[])].sort((a, b) => a - b);
    const packages = [...new Set((item.packages as string[]).map(pkg => pkg.trim().toLowerCase()))].sort();
    if (item.id === 'weekend' && item.enabled && item.allDay !== true) return null;
    if (item.allDay === true && (item.id !== 'weekend' || days.length !== 2 || days[0] !== 0 || days[1] !== 6)) return null;
    if (item.enabled && (!days.length || !selectedApplications && !packages.length)) return null;
    seen.add(item.id);
    schedules.push({ id: item.id as AppSchedule['id'], enabled: item.enabled && (item.allDay === true || item.startMinute !== item.endMinute), startMinute: item.startMinute, endMinute: item.endMinute, days, packages, ...(item.allDay === undefined ? {} : { allDay: item.allDay }) });
  }
  return { version: 1, schedules, ...(selectedApplications ? { targetScope: 'selected-applications' as const } : {}), ...('strictGuard' in input ? { strictGuard: input.strictGuard as boolean } : {}) };
}

/** Static rules only. Timed guards belong to native scheduling, never this list. */
export function getPersistentBlockedAppPackages(settings: DisciplineSettings): string[] {
  return expandDoomscrollAppPackages(settings.emergencyStrictMode || settings.deepFocusModeEnabled
    ? DOOMSCROLL_APP_OPTIONS.map(option => option.androidPackage)
    : settings.blockedAppPackages);
}

export function buildNativeAppScheduleConfiguration(settings: DisciplineSettings, platform: 'android' | 'ios' = 'android'): AppScheduleConfiguration {
  const packages = platform === 'ios' ? [] : [...SUPPORTED_DOOMSCROLL_APP_PACKAGES];
  const timed = (id: 'sleep' | 'work', enabled: boolean, start: string, end: string): AppSchedule => {
    const startMinute = clockMinute(start), endMinute = clockMinute(end);
    return { id, enabled: enabled && startMinute !== null && endMinute !== null && startMinute !== endMinute,
      startMinute: startMinute ?? 0, endMinute: endMinute ?? 0, days: [0, 1, 2, 3, 4, 5, 6], packages: [...packages] };
  };
  const strictGuard = settings.emergencyStrictMode || settings.deepFocusModeEnabled;
  return { version: 1, ...(platform === 'ios' ? { targetScope: 'selected-applications' as const } : {}),
    ...(strictGuard || settings.strictGuardConfiguredAt ? { strictGuard } : {}), schedules: [
    timed('sleep', settings.sleepModeEnabled, settings.sleepStartTime, settings.sleepEndTime),
    timed('work', settings.workHoursEnabled, settings.workStartTime, settings.workEndTime),
    { id: 'weekend', enabled: settings.weekendModeEnabled, startMinute: 0, endMinute: 0, allDay: true, days: [0, 6], packages: [...packages] }
  ] };
}
