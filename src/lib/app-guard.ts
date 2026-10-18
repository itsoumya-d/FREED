import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import type { AppGuardMode, DisciplineSettings } from './recovery-state';
import { expandDoomscrollAppPackages } from './doomscroll-apps';
import { buildNativeAppScheduleConfiguration, getPersistentBlockedAppPackages, type AppScheduleConfiguration } from './app-schedules';

export const APP_GUARD_MODES: ReadonlyArray<{ value: AppGuardMode; label: string }> = [
  { value: 'before-use', label: 'Before use' },
  { value: 'daily-limit', label: 'Daily limit' },
  { value: 'scheduled', label: 'Scheduled' },
];

export function getAppGuardPackages(settings: DisciplineSettings, capability: ProtectionCapability | null) {
  return capability?.appGuardModes === true ? expandDoomscrollAppPackages(settings.blockedAppPackages) : getPersistentBlockedAppPackages(settings);
}

/** Device state is the authority. Inactive scheduled windows can still be installed and ready. */
export function describeAppGuard(capability: ProtectionCapability | null, status: ProtectionStatus | null, expectedMode?: AppGuardMode) {
  const modern = capability?.appGuardModes === true;
  const mode: AppGuardMode = modern ? status?.appGuardMode ?? 'daily-limit' : 'daily-limit';
  const ios = capability?.platform === 'ios';
  const targets = ios ? modern ? status?.selectedApplications ?? 0 : Math.max((status?.selectedApplications ?? 0) + (status?.selectedCategories ?? 0) + (status?.selectedWebDomains ?? 0), status?.selectedScreenTimeTokenCount ?? 0) : status?.blockedApplications ?? 0;
  const authorized = ios ? capability?.screenTime === true && capability.managedSettings === true && status?.authorized === true : capability?.platform === 'android' && capability.accessibility === true && capability.usageStats === true && status?.appInterventionAuthorized === true && status?.usageStatsAuthorized === true;
  const knownMode = status?.appGuardMode === 'before-use' || status?.appGuardMode === 'daily-limit' || status?.appGuardMode === 'scheduled';
  const configured = modern ? knownMode && targets > 0 : ios ? status?.appLimitScheduled === true : targets > 0;
  const ready = status?.protectionConfigurationResetDisabled !== true && targets > 0 && authorized && configured && (!modern || knownMode && status?.appGuardReady === true && (!expectedMode || status.appGuardMode === expectedMode)) && (mode !== 'scheduled' || status?.appSchedulesSupported === true && status?.appSchedulesConfigured === true && status?.appSchedulesServiceConnected === true);
  const scope = mode === 'before-use' ? ios ? 'Before-use pause for selected individual iOS applications.' : 'Before-use interruption for selected Android packages.'
    : mode === 'scheduled' ? ios ? 'Registered time windows for selected individual iOS applications.' : 'Configured time windows for supported distracting Android packages.'
    : ios ? modern ? 'Daily threshold event for selected individual iOS applications.' : 'Daily selected-target threshold event for chosen Screen Time tokens.' : 'Daily foreground-time limit per selected Android package.';
  const explanation = mode === 'before-use' ? 'Selected applications pause immediately once the saved mode, authorization and native guard are ready.'
    : mode === 'scheduled' ? 'Windows use the local device clock. Overlapping guards stay independent. A ready schedule can be outside its active window.'
    : ios ? 'iOS reports a selected-target threshold event; it does not report independent per-app duration.' : 'Each selected package uses its daily foreground duration.';
  return { mode, targets, authorized, configured, ready, scope, explanation: `${explanation} App protection does not inspect in-app content. Test device blocking separately.`, supported: Boolean(ios ? capability?.screenTime && capability.managedSettings : capability?.platform === 'android' && capability.accessibility && capability.usageStats) };
}

export type AppGuardNativeWriter = {
  /** Group-capable builds own configuration through acknowledged group mutations. */
  readStatus?: () => Promise<ProtectionStatus>;
  configurePackages: (packages: string[], limit: number, shortFormSeconds: number) => Promise<ProtectionStatus>;
  configureMode: (mode: AppGuardMode) => Promise<ProtectionStatus>;
  configureSchedules: (configuration: AppScheduleConfiguration) => Promise<ProtectionStatus>;
};

/** Group builds only observe status; compatible legacy adapters retain their serial settings job. */
export async function syncNativeAppGuard(settings: DisciplineSettings, capability: ProtectionCapability | null, native: AppGuardNativeWriter, isCurrent: () => boolean): Promise<ProtectionStatus | null> {
  if (capability?.appGroups === true) {
    if (!isCurrent()) return null;
    if (!native.readStatus) throw new Error('Native app-group protection status is unavailable.');
    const status = await native.readStatus();
    if (!isCurrent()) return null;
    if (status.statusReadAccepted === false) throw new Error('Native app-group protection status could not be read.');
    return status;
  }
  let status = await native.configurePackages(getAppGuardPackages(settings, capability), settings.dailyLimitMinutes, settings.shortFormInterruptionSeconds);
  if (!isCurrent()) return null;
  const checkReset = () => { if (status.protectionConfigurationResetDisabled === true) throw new Error('Protection is paused after reset. Explicitly resume it before applying app guards.'); };
  checkReset();
  if (capability?.appGuardModes === true && settings.appGuardModeConfiguredAt) {
    status = await native.configureMode(settings.appGuardMode);
    if (!isCurrent()) return null;
    checkReset();
    if (status.appGuardModeConfigurationAccepted !== true || status.appGuardMode !== settings.appGuardMode) throw new Error('Native app guard mode was rejected.');
  } else if (capability?.appGuardModes !== true && settings.appGuardModeConfiguredAt && settings.appGuardMode !== 'daily-limit') {
    throw new Error('This installed build does not support the saved app guard mode.');
  }
  if (capability?.platform === 'android' || capability?.platform === 'ios') {
    const configuration = buildNativeAppScheduleConfiguration(settings, capability.platform);
    status = await native.configureSchedules(configuration);
    if (!isCurrent()) return null;
    checkReset();
    if (capability.appSchedules === true && status.appSchedulesConfigurationAccepted !== true) throw new Error('Native schedule configuration was rejected.');
    if (capability.appGuardModes === true && 'strictGuard' in configuration && (status.appSchedulesConfigurationAccepted !== true || status.strictAppGuardEnabled !== configuration.strictGuard)) throw new Error('Native strict app guard configuration was rejected.');
  }
  return isCurrent() ? status : null;
}
