import type { ProtectionStatus } from './index';
import type { NativeAccountBinding } from './native-account-contract';

export type ProtectionAuthorizationOutcome = 'granted' | 'denied' | 'cancelled' | 'error' | 'unsupported';
export type ProtectionStatusReadError = 'native-status-v2-unavailable' | 'native-device-status-unavailable' |
  'native-status-read-failed' | 'native-status-timeout' | 'native-status-malformed' |
  'native-status-binding-stale' | 'native-status-unavailable';
const errors: readonly string[] = ['native-status-v2-unavailable','native-device-status-unavailable',
  'native-status-read-failed','native-status-timeout','native-status-malformed','native-status-binding-stale','native-status-unavailable'];
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const publicFields = new Set(['statusVersion','statusVisibility','statusReadAccepted','authorized','active','mode','message',
  'adultFilterActive','adultFilterRequested','adultWebPolicyConfigured','adultWebPolicyReason','safariExtensionSettingsAvailable',
  'safariContentBlockerEnabled','safariContentBlockerStateCheckedAt','safariContentBlockerStateError']);

export function unavailableProtectionStatus(reason: ProtectionStatusReadError): ProtectionStatus {
  return { authorized: false, active: false, mode: 'screen-time', message: 'Native protection status could not be read.',
    statusReadAccepted: false, statusReadError: reason };
}

export function nativeStatusReadError(value: unknown): ProtectionStatusReadError | null {
  const source = record(value);
  return source?.statusReadAccepted === false && typeof source.statusReadError === 'string' && errors.includes(source.statusReadError)
    ? source.statusReadError as ProtectionStatusReadError : null;
}

/** A rejection dictionary is never a status. iOS v2 also binds the reply to the exact admitted read. */
export function validateProtectionStatus(value: unknown, visibility: 'account' | 'device' | 'android', binding?: NativeAccountBinding): ProtectionStatus | null {
  const source = record(value);
  if (!source || source.accepted === false || source.statusReadAccepted === false ||
      typeof source.authorized !== 'boolean' || typeof source.active !== 'boolean' ||
      typeof source.mode !== 'string' || !['screen-time','accessibility','dns','vpn-fallback','prototype'].includes(source.mode) ||
      typeof source.message !== 'string') return null;
  if (visibility === 'android') return { ...source } as ProtectionStatus;
  if (source.statusVersion !== 2 || source.statusReadAccepted !== true || source.statusVisibility !== visibility || source.mode !== 'screen-time') return null;
  if (visibility === 'device') {
    if (Object.keys(source).some(key => !publicFields.has(key))) return null;
  } else {
    const reply = record(source.statusBinding);
    if (!binding || !reply || Object.keys(reply).length !== 5 || reply.bindingHandle !== binding.bindingHandle ||
        reply.actionScope !== binding.actionScope || reply.generation !== binding.generation ||
        reply.scopeEpoch !== binding.scopeEpoch || reply.admissionRevision !== binding.admissionRevision) return null;
  }
  for (const key of ['adultFilterActive','adultFilterRequested','adultWebPolicyConfigured','safariExtensionSettingsAvailable','safariContentBlockerEnabled',
    'scheduled','appInterventionAuthorized','appGuardReady','appSchedulesSupported','appSchedulesConfigured','appSchedulesServiceConnected',
    'strictAppGuardEnabled','strictAppGuardActive','appLimitScheduled','appLimitReachedToday','selectedShieldsPausedForEarnedUnlock',
    'adultFilterStaysActiveDuringEarnedUnlock','appGroupBreakEffective','protectionConfigurationResetDisabled']) {
    if (source[key] !== undefined && typeof source[key] !== 'boolean') return null;
  }
  for (const key of ['selectedApplications','selectedCategories','selectedWebDomains','selectedScreenTimeTokenCount',
    'activeAppSchedulePackageCount','dailyLimitMinutes','appGroupBreakRevision','appGroupRemainingRestrictionCount','safariContentBlockerRuleCount']) {
    if (source[key] !== undefined && (typeof source[key] !== 'number' || !Number.isSafeInteger(source[key]) || (source[key] as number) < 0)) return null;
  }
  for (const key of ['safariContentBlockerStateCheckedAt','safariContentBlockerStateError','safariContentBlockerLastReloadError',
    'activeUnlockExpiresAt','activeUnlockInterventionId','appGroupBreakGroupId']) {
    if (source[key] !== undefined && typeof source[key] !== 'string') return null;
  }
  if (source.adultWebPolicyReason !== undefined && source.adultWebPolicyReason !== null && typeof source.adultWebPolicyReason !== 'string') return null;
  // iOS currently emits activeAppScheduleIds; validate every collection in the
  // shared status type before consumers call map/includes or enumerate minutes.
  for (const key of ['activeAppScheduleIds','usageStatsObservedPackageNames','androidSettingsRoutes']) {
    const values = source[key];
    if (values === undefined) continue;
    if (!Array.isArray(values) || values.length > 4096) return null;
    for (let index = 0; index < values.length; index++) {
      if (typeof values[index] !== 'string' || values[index].length > 4096) return null;
    }
  }
  if (source.usageStatsTodayMinutesByPackage !== undefined) {
    const minutes = record(source.usageStatsTodayMinutesByPackage);
    if (!minutes || Object.prototype.toString.call(minutes) !== '[object Object]') return null;
    const entries = Object.entries(minutes);
    if (entries.length > 4096 || entries.some(([key, value]) => key.length > 4096 ||
        typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null;
  }
  return { ...source } as ProtectionStatus;
}
