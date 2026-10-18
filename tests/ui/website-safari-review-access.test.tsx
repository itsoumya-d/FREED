import React from 'react';
import { AppState, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ProtectionFeatureSetup } from '@/components/ProtectionFeatureSetup';
import { appI18n } from '@/i18n/runtime';
import { useEncryptedDns } from '@/hooks/use-encrypted-dns';
import * as Native from 'freed-protection';

jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }), useOptionalAppPreferences: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/lib/adult-domain-feed-sync', () => ({ syncNativeAdultDomainFeed: jest.fn() }));
jest.mock('freed-protection', () => ({
  applyAdultContentFilter: jest.fn(), requestProtectionAuthorization: jest.fn(), presentFamilyActivityPicker: jest.fn(),
  openUsageAccessSettings: jest.fn(), openProtectionSettings: jest.fn(), openPrivateDnsSettings: jest.fn(),
  openVpnSettings: jest.fn(), openSafariExtensionSettings: jest.fn(), getEncryptedDnsStatus: jest.fn(), configureEncryptedDns: jest.fn(),
}));

let mockMode: 'light' | 'dark' = 'light';
const capability = { platform: 'ios' as const, screenTime: true, managedSettings: true, safariContentBlocker: true, accessibility: false, dnsFiltering: false, localVpnFallback: false, notes: [] };
const policy = { authorized: true, adultFilterActive: true, adultWebPolicyConfigured: true, active: true, mode: 'screen-time' as const, message: '' };
const dnsOff = { configurationLabel: 'FREED DNS', supported: true, releaseEnabled: true, configured: false, enabled: false, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false };
const settingsReceipt = { ...policy, safariExtensionSettingsOpened: true, safariExtensionSettingsTarget: 'focus-shield', safariExtensionSettingsRoute: 'extension' };
function FreshDeviceMutationFixture() {
  const { acknowledgeOperation } = useEncryptedDns();
  React.useEffect(() => { acknowledgeOperation(); }, [acknowledgeOperation]);
  return null;
}
async function setup() {
  const close = jest.fn();
  const refresh = jest.fn(async () => ({ capability, status: policy, readTicket: { revision: 1, isCurrent: () => true } }));
  const view = render(<ProtectionFeatureSetup intent="websites" capability={capability} status={policy} appCount={0} onRefresh={refresh} onChooseApps={jest.fn()} onSyncApps={jest.fn()} onClose={close} vpnDisclosureAcknowledged={false} onAcknowledgeVpnDisclosure={jest.fn()} />);
  await act(async () => {});
  return { view, close, refresh };
}
function reviewSafari(view: ReturnType<typeof render>) {
  fireEvent.press(view.getByTestId('website-review-setup'));
  fireEvent.press(view.getByTestId('website-review-safari'));
}
const initialAppState = AppState.currentState;
beforeEach(async () => {
  (AppState as any).currentState = 'active'; mockMode = 'light';
  await appI18n.changeLanguage('en');
  localStorage.removeItem('freed.dns.settings-guide.v1');
  (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue(dnsOff);
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue(settingsReceipt);
  jest.spyOn(Linking, 'openURL').mockResolvedValue();
  const fixture = render(<FreshDeviceMutationFixture />); await act(async () => {}); fixture.unmount();
});
afterEach(() => { (AppState as any).currentState = initialAppState; jest.restoreAllMocks(); });

// Removing actionable content from the expanded review row breaks this journey
// before its native handoff, while the independent current task remains Save DNS.
test.each(['light', 'dark'] as const)('Safari repair is reachable through Review while DNS is off in %s', async mode => {
  mockMode = mode;
  const { view } = await setup();
  expect(view.getByTestId('website-next-step')).toHaveTextContent(/Save DNS configuration/);
  expect(view.queryByTestId('website-safari-recovery')).toBeNull();
  reviewSafari(view);
  expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');
  expect(view.getByTestId('website-safari-recovery')).toHaveTextContent(/Blocking, browsing and Open Challenge remain unverified/);
  expect(view.getByTestId('website-safari-recovery-setup')).not.toBeDisabled();
  expect(view.queryByTestId('website-safari-observation-details')).toBeNull();
  expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(Native.openSafariExtensionSettings).toHaveBeenCalledTimes(1);
  expect(Native.openSafariExtensionSettings).toHaveBeenCalledWith('focus-shield');
  expect(view.getAllByTestId('website-safari-settings-feedback')).toHaveLength(1);
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
  expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');
  expect(view.getByTestId('website-next-step')).toHaveTextContent(/Save DNS configuration/);
  expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Browsing test needed');
  fireEvent.press(view.getByTestId('website-test-toggle'));
  expect(view.getByTestId('website-safari-recovery')).toHaveTextContent(/Open Challenge/);
  expect(Linking.openURL).not.toHaveBeenCalled();
  expect(Native.configureEncryptedDns).not.toHaveBeenCalled();
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
  expect(Native.requestProtectionAuthorization).not.toHaveBeenCalled();
});

test('Review Safari refresh preserves unknown facts and collapse/return/Done do not start actions', async () => {
  const { view, close, refresh } = await setup();
  reviewSafari(view);
  const previousReads = refresh.mock.calls.length;
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-refresh')); });
  expect(refresh).toHaveBeenCalledTimes(previousReads + 1);
  expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');
  expect(view.getByTestId('website-next-step')).toHaveTextContent(/Save DNS configuration/);
  fireEvent.press(view.getByTestId('website-review-safari'));
  expect(view.queryByTestId('website-safari-recovery')).toBeNull();
  fireEvent.press(view.getByTestId('website-review-safari'));
  expect(view.getByTestId('website-safari-recovery')).toBeOnTheScreen();
  fireEvent.press(view.getByTestId('website-return-current'));
  expect(view.queryByTestId('website-review-steps')).toBeNull();
  expect(view.queryByTestId('website-safari-recovery')).toBeNull();
  fireEvent.press(view.getByTestId('feature-setup-leave'));
  expect(close).toHaveBeenCalledTimes(1);
  expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled();
  expect(Native.configureEncryptedDns).not.toHaveBeenCalled();
});

test('current Safari stage keeps one instance of controls when its review row expands', async () => {
  (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({ ...dnsOff, configured: true, enabled: true });
  const { view } = await setup();
  await act(async () => { fireEvent.press(view.getByTestId('website-configuration-check')); });
  reviewSafari(view);
  fireEvent.press(view.getByTestId('website-safari-details'));
  for (const id of ['website-safari-recovery', 'website-safari-details', 'website-safari-refresh', 'website-safari-recovery-setup', 'website-test-toggle']) expect(view.getAllByTestId(id)).toHaveLength(1);
  expect(view.getByTestId('website-next-step')).toHaveTextContent(/Recovery in Safari/);
});

test.each(['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'])('reviewed Safari repair uses existing localized controls in %s', async language => {
  await appI18n.changeLanguage(language);
  const { view } = await setup();
  reviewSafari(view);
  const settings = view.getByTestId('website-safari-recovery-setup');
  expect(settings.props.accessibilityLabel).toBe(appI18n.t('safariConfiguration.openSettings'));
  expect(settings).toHaveStyle({ minHeight: 48 });
  expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent(appI18n.t('guidedWebsiteSetup.notConfirmed'));
  expect(view.getByTestId('website-safari-refresh').props.accessibilityLabel).toBe(appI18n.t('safariConfiguration.refresh'));
  expect(view.queryByTestId('website-safari-observation-details')).toBeNull();
  expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled();
});
