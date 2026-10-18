import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FunctionalToday } from '@/components/FunctionalToday';
import { ProtectOverview } from '@/components/ProtectOverview';
import { getProtectionSetupReadiness } from '@/lib/protection-readiness';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
import { appI18n } from '@/i18n/runtime';
import { createAppGroupsController } from '@/lib/app-groups-controller';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronRight: () => null, ChevronLeft: () => null }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/NativeAppGroupLabels', () => ({ NativeAppGroupLabels: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('expo-router', () => ({ Link: ({ children }: any) => children }));
jest.mock('@/hooks/use-encrypted-dns', () => ({ useEncryptedDns: () => mockDns }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: false }) }));

const ios: any = { platform: 'ios', screenTime: true, managedSettings: true, notes: [] };
const policy: any = { authorized: true, adultFilterActive: true, adultWebPolicyConfigured: true, active: true, mode: 'screen-time', message: '' };
const dns = { supported: true, releaseEnabled: true, configured: true, enabled: true, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false };
let mockDns: any;
beforeEach(async () => {
  await appI18n.changeLanguage('en');
  mockDns = { status: { ...dns }, lastCheckedAt: 100, pending: null, error: null };
});

function screenPair(extra: any = {}) {
  const state = createDefaultRecoveryState();
  const capability = extra.capability === undefined ? ios : extra.capability;
  const status = extra.status === undefined ? policy : extra.status;
  const onShield = jest.fn(), onCheckIn = jest.fn();
  const view = render(<>
    <FunctionalToday recoveryState={state} streakDays={0}
      protectionReadiness={getProtectionSetupReadiness(capability, status, 0)}
      protectionCapability={capability} protectionStatus={status}
      protectionSyncing={extra.syncing} protectionSyncMessage={extra.syncMessage}
      protectionObservations={extra.observations} protectionGoal={extra.goal ?? 'websites'}
      protectionGroups={extra.groups} protectionGroupsPending={extra.groupsPending}
      protectionGroupsError={extra.groupsError} protectionGroupsWaitingForOwner={extra.waitingForOwner}
      onCheckIn={onCheckIn} onJournal={jest.fn()} onPanic={jest.fn()} onMovement={jest.fn()}
      onBreathing={jest.fn()} onCoach={jest.fn()} onOpenLibrary={jest.fn()}
      onOpenShield={onShield} onOpenProgress={jest.fn()} onHabitToggle={jest.fn()}
      onPlanChange={jest.fn()} onTakePledge={jest.fn()} />
    <ProtectOverview capability={capability} status={status} settings={state.disciplineSettings}
      groups={extra.groups} groupsPending={extra.groupsPending} groupsError={extra.groupsError} groupsWaitingForOwner={extra.waitingForOwner}
      onSetup={jest.fn()} observations={extra.observations} syncing={extra.syncing} syncMessage={extra.syncMessage} />
  </>);
  return { view, onShield, onCheckIn };
}

test('a configured Apple policy cannot tell Today On when DNS is missing in Protect', () => {
  mockDns.status = { ...dns, configured: false, enabled: false };
  const { view, onShield, onCheckIn } = screenPair();
  expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Needs attention');
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(/Adult websites: Needs attention/);
  expect(view.getByTestId('home-protection-status')).not.toHaveTextContent(/Adult website protection on/);
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(/Save Cloudflare Families DNS/);
  fireEvent.press(view.getByTestId('home-primary-action'));
  expect(onShield).toHaveBeenCalledTimes(1);
  expect(onCheckIn).not.toHaveBeenCalled();
});

const appGroup: any = {
  id: 'selected', revision: 2, name: 'Selected apps', enabled: true, rule: { kind: 'daily-limit', limitMinutes: 30 },
  packages: [], draftApplicationCount: null, applicationCount: 1, categoryCount: 0, webDomainCount: 0,
  legacy: false, configured: true, ready: true, active: false, thresholdReached: false,
  unavailablePackages: [], usageMinutes: null, nextBoundaryAt: null, break: null,
};
const appGroups: any = {
  version: 1, supported: true, platform: 'ios', revision: 2, configurationGeneration: 0, scopeEpoch: 1,
  groups: [appGroup], permissions: { authorized: true, usageAccess: true, runtimeConnected: true },
  monitorBudget: { used: 1, limit: 20 }, maxGroups: 6,
  legacyCompatibility: { retained: false, applicationCount: 0, categoryCount: 0, webDomainCount: 0 }, reason: null,
};

test.each([
  ['pending edits on a working rule', { groups: { ...appGroups, groups: [{ ...appGroup, draftApplicationCount: 2 }] } }, 'Needs attention'],
  ['pending-only selection', { groups: { ...appGroups, groups: [{ ...appGroup, enabled: false, ready: false, applicationCount: 0, draftApplicationCount: 1 }] } }, 'Needs attention'],
  ['confirmed ready group', { groups: appGroups }, 'On'],
  ['disabled selection', { groups: { ...appGroups, groups: [{ ...appGroup, enabled: false, ready: false }] } }, 'Off'],
  ['native activation not confirmed', { groups: { ...appGroups, groups: [{ ...appGroup, ready: false }] } }, 'Needs attention'],
  ['read error despite cached ready state', { groups: appGroups, groupsError: 'app-groups-read-failed' }, 'Needs attention'],
  ['mutation pending despite cached ready state', { groups: appGroups, groupsPending: true }, 'Needs attention'],
  ['owner snapshot not available', { groups: null, waitingForOwner: true }, 'Checking device configuration'],
  ['unsupported native groups', { groups: { ...appGroups, supported: false, groups: [], reason: 'native-module-unavailable' } }, 'Unavailable'],
  ['retained independent legacy configuration', { groups: { ...appGroups, groups: [], legacyCompatibility: { ...appGroups.legacyCompatibility, retained: true, applicationCount: 1 } } }, 'Independent protection configured'],
] as const)('Today and Protect agree for %s', (_name, extra, expected) => {
  const { view } = screenPair({ ...extra, capability: { ...ios, appGroups: true }, goal: 'apps' });
  expect(view.getByTestId('protect-apps-status')).toHaveTextContent(expected);
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(new RegExp(`Apps: ${expected}`));
});

test('a confirmed native group permits daily check-in while a pending selection routes back to protection', () => {
  const ready = screenPair({ groups: appGroups, capability: { ...ios, appGroups: true }, goal: 'apps' });
  fireEvent.press(ready.view.getByTestId('home-primary-action'));
  expect(ready.onCheckIn).toHaveBeenCalledTimes(1); expect(ready.onShield).not.toHaveBeenCalled();
  ready.view.unmount();
  const pending = screenPair({ groups: { ...appGroups, groups: [{ ...appGroup, draftApplicationCount: 2 }] }, capability: { ...ios, appGroups: true }, goal: 'apps' });
  fireEvent.press(pending.view.getByTestId('home-primary-action'));
  expect(pending.onShield).toHaveBeenCalledTimes(1); expect(pending.onCheckIn).not.toHaveBeenCalled();
});

test.each([
  ['capability unavailable', 'app-groups-native-unavailable', 'Unavailable'],
  ['invalid native readback', 'app-groups-read-invalid', 'Needs attention'],
  ['native read failure', 'app-groups-read-failed', 'Needs attention'],
] as const)('actual controller %s remains correctly identified on both root screens', async (_label, reason, expected) => {
  const controller = createAppGroupsController({
    getScope: () => '["owner",1]',
    bind: async () => ({ version: 1, operationId: '11111111-1111-4111-8111-111111111111', supported: true, accepted: true, bindingCurrent: true, ownerVerified: true, stage: 'complete', reason: null, generation: 0, scopeEpoch: 1, errorCode: null, errorDomain: null }),
    suspend: async () => true,
    read: async () => ({ ...appGroups, supported: false, groups: [], reason }),
    mutate: async () => ({ accepted: false, reason: 'unused', snapshot: appGroups }),
  });
  await controller.refresh();
  const observed = controller.getSnapshot();
  // Feed the real controller publication, including its mirrored reason/error.
  const { view } = screenPair({ capability: { ...ios, appGroups: true }, groups: observed.status, groupsError: observed.error, groupsPending: observed.pending, waitingForOwner: observed.waitingForOwner });
  expect(view.getByTestId('protect-apps-status')).toHaveTextContent(expected);
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(new RegExp(`Apps: ${expected}`));
});

test('an actual failed refresh vetoes a cached ready group without discarding its working rule', async () => {
  let failRead = false;
  const controller = createAppGroupsController({
    getScope: () => '["owner",1]',
    bind: async () => ({ version: 1, operationId: '11111111-1111-4111-8111-111111111111', supported: true, accepted: true, bindingCurrent: true, ownerVerified: true, stage: 'complete', reason: null, generation: 0, scopeEpoch: 1, errorCode: null, errorDomain: null }),
    suspend: async () => true,
    read: async () => { if (failRead) throw Error('native read failed'); return appGroups; },
    mutate: async () => ({ accepted: false, reason: 'unused', snapshot: appGroups }),
  });
  await controller.refresh(); failRead = true; await controller.refresh();
  const observed = controller.getSnapshot();
  const { view } = screenPair({ capability: { ...ios, appGroups: true }, groups: observed.status, groupsError: observed.error, groupsPending: observed.pending, waitingForOwner: observed.waitingForOwner });
  expect(view.getByTestId('protect-apps-group-selected')).toBeOnTheScreen();
  expect(view.getByTestId('protect-apps-status')).toHaveTextContent('Needs attention');
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(/Apps: Needs attention/);
});

test.each([
  ['configuration only', () => ({}), 'Needs attention'],
  ['refresh pending', () => { mockDns.pending = 'refresh'; return {}; }, 'Needs attention'],
  ['native read error', () => { mockDns.error = 'read-failed'; return {}; }, 'Needs attention'],
  ['known routing failure', () => { mockDns.status.healthy = false; return {}; }, 'Needs attention'],
  ['off', () => { mockDns.status = { ...dns, configured: false, enabled: false }; return { status: { ...policy, authorized: false, adultFilterActive: false, adultWebPolicyConfigured: false } }; }, 'Off'],
  ['unsupported', () => { mockDns.status = { ...dns, supported: false, releaseEnabled: false, configured: false, enabled: false }; return { capability: null, status: null }; }, 'Unavailable'],
] as const)('Today and Protect agree for %s without a browsing pass', (_name, setup, expected) => {
  const { view } = screenPair(setup());
  expect(view.getByTestId('protect-websites-status')).toHaveTextContent(expected);
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(new RegExp(`Adult websites: ${expected}`));
  expect(view.getByTestId('home-protection-status')).not.toHaveTextContent(/Adult website protection on/);
});

test('current routing and both browser observations permit the same On state and daily check-in', () => {
  const observations = { readbackAt: 100, enablement: 'observed-current', routing: 'observed-current', adultBrowsing: 'observed-blocked', ordinaryBrowsing: 'observed-allowed' };
  const { view, onCheckIn, onShield } = screenPair({ observations });
  expect(view.getByTestId('protect-websites-status')).toHaveTextContent('On');
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(/Adult website protection on/);
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(/Adult websites: On/);
  fireEvent.press(view.getByTestId('home-primary-action'));
  expect(onCheckIn).toHaveBeenCalledTimes(1);
  expect(onShield).not.toHaveBeenCalled();
});

test.each(['stale-readback', 'pending-refresh', 'warning', 'missing-normal-browser'] as const)('%s invalidates earlier proof on both root screens', kind => {
  const observations: any = { readbackAt: 100, enablement: 'observed-current', routing: 'observed-current', adultBrowsing: 'observed-blocked', ordinaryBrowsing: 'observed-allowed' };
  if (kind === 'stale-readback') mockDns.lastCheckedAt = 101;
  if (kind === 'pending-refresh') mockDns.pending = 'refresh';
  if (kind === 'missing-normal-browser') observations.ordinaryBrowsing = 'unobserved';
  const { view, onShield, onCheckIn } = screenPair({ observations, syncMessage: kind === 'warning' ? 'Current configuration is unknown.' : null });
  expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Needs attention');
  expect(view.getByTestId('home-protection-status')).toHaveTextContent(/Adult websites: Needs attention/);
  expect(view.getByTestId('home-protection-status')).not.toHaveTextContent(/Adult website protection on/);
  fireEvent.press(view.getByTestId('home-primary-action'));
  expect(onShield).toHaveBeenCalledTimes(1);
  expect(onCheckIn).not.toHaveBeenCalled();
});
