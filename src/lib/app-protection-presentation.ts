import type { AppGroupsSnapshot } from './app-groups-contract';
import type { ProtectionFeatureReadiness } from './protection-readiness';

export type AppProtectionPresentation = {
  status: ProtectionFeatureReadiness['status'] | 'Checking device configuration' | 'Independent protection configured';
  ready: boolean;
};

/** A pending selection is not the installed selection. Native readiness and
 * owner-fenced controller results are the only inputs to the modern summary.
 * Active describes a current barrier; ready can also describe a monitored
 * daily allowance or a schedule that has not reached its boundary yet.
 */
export function getAppProtectionPresentation(input: {
  modernGroups: boolean;
  groups?: AppGroupsSnapshot | null;
  pending?: boolean;
  error?: string | null;
  waitingForOwner?: boolean;
  legacy: ProtectionFeatureReadiness;
}): AppProtectionPresentation {
  if (!input.modernGroups) return { status: input.legacy.status, ready: input.legacy.ready };
  const groups = input.groups;
  // The controller mirrors a native snapshot's reason into error. Capability
  // absence is distinct from a failed read/mutation, including stale failures
  // retained alongside a cached snapshot. Only the same absence reason may
  // bypass the operational-error veto.
  const capabilityUnavailable = groups?.supported === false &&
    ['app-groups-native-unavailable', 'native-module-unavailable'].includes(groups.reason ?? '');
  if (capabilityUnavailable && (!input.error || input.error === groups?.reason)) return { status: 'Unavailable', ready: false };
  if (input.error) return { status: 'Needs attention', ready: false };
  if (!groups || input.waitingForOwner) return { status: 'Checking device configuration', ready: false };
  if (!groups.supported) return { status: groups.reason ? 'Needs attention' : 'Unavailable', ready: false };
  const changedSelection = groups.groups.some(group => group.draftApplicationCount != null);
  const unavailableSelection = groups.groups.some(group => group.enabled && (group.unavailablePackages?.length ?? 0) > 0);
  const selected = (group: AppGroupsSnapshot['groups'][number]) => group.applicationCount > 0 || group.packages.length > 0;
  const unconfirmedRule = groups.groups.some(group => group.enabled && (!group.ready || group.configured === false || !selected(group)));
  if (input.pending || groups.reason || changedSelection || unavailableSelection || unconfirmedRule) return { status: 'Needs attention', ready: false };
  if (groups.groups.some(group => group.enabled && group.ready && group.configured !== false && selected(group))) return { status: 'On', ready: true };
  if (groups.legacyCompatibility.retained && groups.legacyCompatibility.applicationCount > 0) return { status: 'Independent protection configured', ready: false };
  return { status: 'Off', ready: false };
}
