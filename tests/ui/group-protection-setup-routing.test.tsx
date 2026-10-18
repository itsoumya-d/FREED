import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ProtectionFeatureSetup } from '@/components/ProtectionFeatureSetup';
import { appI18n } from '@/i18n/runtime';
import * as Native from 'freed-protection';

jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: any) => require('react').useEffect(effect, [effect]) }));
jest.mock('freed-protection', () => ({
  applyAdultContentFilter: jest.fn(), requestProtectionAuthorization: jest.fn(), presentFamilyActivityPicker: jest.fn(),
  openUsageAccessSettings: jest.fn(), openProtectionSettings: jest.fn(), openPrivateDnsSettings: jest.fn(),
  openVpnSettings: jest.fn(), openSafariExtensionSettings: jest.fn(),
}));
const ios: any = { platform: 'ios', screenTime: true, managedSettings: true, appGuardModes: true, appGroups: true, accessibility: false, dnsFiltering: false, localVpnFallback: false, notes: [] };
const off: any = { authorized: true, active: false, mode: 'screen-time', message: '', selectedApplications: 0, appGuardMode: 'daily-limit', appGuardReady: false };
const ready = { ...off, selectedApplications: 2, appGuardReady: true };
function setup(capability = ios, status = off) {
  const choose = jest.fn(), close = jest.fn(), save = jest.fn(async () => ready), sync = jest.fn(async () => ready), limit = jest.fn();
  const refresh = jest.fn(async (): Promise<any> => ({ capability, status }));
  const props = { intent: 'apps' as const, capability, status, appCount: 0, onRefresh: refresh, onChooseApps: choose, onSyncApps: sync, onClose: close,
    onAppGuardSave: save, onDailyLimitChange: limit, vpnDisclosureAcknowledged: true, onAcknowledgeVpnDisclosure: jest.fn(), getActionScope: () => 'owner-a' };
  return { choose, close, save, sync, limit, refresh, props, view: render(<ProtectionFeatureSetup {...props} />) };
}
beforeEach(async () => { (Native.requestProtectionAuthorization as jest.Mock).mockReset(); (AppState as any).currentState = 'active'; await appI18n.changeLanguage('en'); });
afterEach(() => jest.restoreAllMocks());
function noLegacyWrites(f: ReturnType<typeof setup>) {
  expect(f.save).not.toHaveBeenCalled(); expect(f.sync).not.toHaveBeenCalled(); expect(f.limit).not.toHaveBeenCalled();
  expect(Native.presentFamilyActivityPicker).not.toHaveBeenCalled(); expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
}
test.each([off, ready])('group setup exposes the shared-rule editor without global controls or completion from global readback: %j', async status => {
  const f = setup(ios, status); await act(async () => {});
  for (const id of ['setup-mode-before-use', 'setup-mode-daily-limit', 'setup-mode-scheduled', 'setup-mode-save', 'setup-limit-increase', 'setup-limit-decrease', 'setup-guard-state']) expect(f.view.queryByTestId(id)).toBeNull();
  expect(f.view.queryByRole('button', { name: 'Done' })).toBeNull(); expect(f.view.queryByText(/^On$/)).toBeNull();
  expect(f.view.getByTestId('feature-setup-continue')).toHaveTextContent('Choose apps');
  await act(async () => { fireEvent.press(f.view.getByTestId('feature-setup-continue')); fireEvent.press(f.view.getByTestId('feature-setup-continue')); });
  expect(f.choose).toHaveBeenCalledTimes(1); expect(f.close).not.toHaveBeenCalled(); noLegacyWrites(f);
});
test.each([
  ['iOS target selection', ios, off],
  ['iOS configured guard', ios, { ...off, selectedApplications: 2 }],
  ['Android selection', { ...ios, platform: 'android', usageStats: true, accessibility: true }, { ...off, appInterventionAuthorized: true, usageStatsAuthorized: true, blockedApplications: 0 }],
  ['Android configured guard', { ...ios, platform: 'android', usageStats: true, accessibility: true }, { ...off, appInterventionAuthorized: true, usageStatsAuthorized: true, blockedApplications: 2 }],
])('%s routes the current setup action to the group editor exactly once', async (_name, capability, status) => {
  const f = setup(capability, status); await act(async () => {});
  await act(async () => { fireEvent.press(f.view.getByTestId('feature-setup-continue')); });
  expect(f.choose).toHaveBeenCalledTimes(1); expect(f.close).not.toHaveBeenCalled(); noLegacyWrites(f);
});
test.each(['denied', 'cancelled'])('group setup preserves %s permission outcome despite authorized readback, then retries without a legacy writer', async outcome => {
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValueOnce({ authorizationOutcome: outcome, authorized: false }).mockResolvedValueOnce({ authorizationOutcome: 'granted', authorized: true });
  const f = setup(ios, { ...off, authorized: false }); await act(async () => {});
  f.refresh.mockResolvedValue({ capability: ios, status: ready });
  await act(async () => { fireEvent.press(f.view.getByTestId('feature-setup-continue')); });
  f.view.rerender(<ProtectionFeatureSetup {...f.props} status={ready} />);
  expect(f.view.getByRole('alert')).toHaveTextContent(outcome === 'denied' ? /not allowed/i : /cancel/i);
  expect(f.view.getByTestId('feature-setup-continue')).not.toBeDisabled(); expect(f.choose).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(f.view.getByTestId('feature-setup-continue')); });
  expect(Native.requestProtectionAuthorization).toHaveBeenCalledTimes(2); expect(f.view.queryByRole('alert')).toBeNull();
  await act(async () => { fireEvent.press(f.view.getByTestId('feature-setup-continue')); });
  expect(f.choose).toHaveBeenCalledTimes(1); expect(f.close).not.toHaveBeenCalled(); noLegacyWrites(f);
});
test('failed permission readback remains retryable and does not become group activation', async () => {
  (Native.requestProtectionAuthorization as jest.Mock).mockResolvedValue({ authorizationOutcome: 'granted', authorized: true });
  const f = setup(ios, { ...off, authorized: false }); await act(async () => {}); f.refresh.mockRejectedValueOnce(new Error('read failed'));
  await act(async () => { fireEvent.press(f.view.getByTestId('feature-setup-continue')); });
  expect(f.view.getByRole('alert')).toHaveTextContent(/status could not refresh/i); expect(f.view.getByTestId('feature-setup-continue')).not.toBeDisabled();
  expect(f.choose).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled(); noLegacyWrites(f);
});
test.each(['owner', 'unmount', 'background'])('late authorization cannot route or publish a result across the %s boundary', async boundary => {
  let finish!: (receipt: any) => void;
  (Native.requestProtectionAuthorization as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const f = setup(ios, { ...off, authorized: false }); await act(async () => {});
  fireEvent.press(f.view.getByTestId('feature-setup-continue'));
  if (boundary === 'owner') f.view.rerender(<ProtectionFeatureSetup {...f.props} getActionScope={() => 'owner-b'} />);
  else if (boundary === 'unmount') f.view.unmount(); else (AppState as any).currentState = 'background';
  await act(async () => { finish({ authorizationOutcome: 'denied', authorized: false }); });
  expect(f.choose).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled(); noLegacyWrites(f);
  if (boundary !== 'unmount') expect(f.view.queryByRole('alert')).toBeNull();
});
test('background taps cannot start group navigation', async () => {
  const f = setup(); await act(async () => {}); (AppState as any).currentState = 'background';
  await act(async () => { fireEvent.press(f.view.getByTestId('feature-setup-continue')); });
  expect(f.choose).not.toHaveBeenCalled(); noLegacyWrites(f);
});
