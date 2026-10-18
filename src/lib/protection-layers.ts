import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import { isDnsGuardFiltering } from './dns-guard-health';
import { getSelectedScreenTimeTargetCount } from './protection-permissions';
export type ProtectionLayer = { id: 'dns' | 'screen-time' | 'apps' | 'safari'; title: string; state: 'active' | 'off' | 'limited' | 'paused' | 'unavailable' };
export function describeProtectionLayers(capability: ProtectionCapability | null, status: ProtectionStatus | null): ProtectionLayer[] {
  const ios = capability?.platform === 'ios'; const android = capability?.platform === 'android';
  const webSupported = ios ? capability?.managedSettings : android ? capability?.localVpnFallback : false;
  const webActive = ios ? status?.authorized === true && status.adultFilterActive === true : android ? isDnsGuardFiltering({ runtimeReady: status?.dnsGuardRuntimeReady, adultFilterActive: status?.adultFilterActive, dnsGuardCoverageReady: status?.dnsGuardCoverageReady, dnsGuardCaptivePaused: status?.dnsGuardCaptivePaused }) : false;
  const paused = android && status?.dnsGuardCaptivePaused === true;
  const appSupported = ios ? capability?.screenTime : android ? capability?.accessibility && capability.usageStats : false;
  const appsActive = ios ? status?.authorized === true && getSelectedScreenTimeTargetCount(status) > 0 && status?.appLimitScheduled === true : android ? status?.appInterventionAuthorized === true && status?.usageStatsAuthorized === true && (status?.blockedApplications ?? 0) > 0 : false;
  const layers: ProtectionLayer[] = [
    { id: ios ? 'screen-time' : 'dns', title: 'Adult website filter', state: !webSupported ? 'unavailable' : paused ? 'paused' : webActive ? 'active' : status ? 'limited' : 'unavailable' },
    { id: 'apps', title: 'Selected app limits', state: !appSupported ? 'unavailable' : status?.selectedShieldsPausedForEarnedUnlock ? 'paused' : appsActive ? 'active' : 'limited' },
  ];
  if (ios) layers.push({ id: 'safari', title: 'Safari content blocker', state: !capability?.safariContentBlocker ? 'unavailable' : status?.safariContentBlockerEnabled === true ? 'active' : status?.safariContentBlockerEnabled === false ? 'off' : 'limited' });
  return layers;
}
