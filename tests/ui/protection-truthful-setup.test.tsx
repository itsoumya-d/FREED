import React from 'react';
import { AppState, Linking } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ProtectionFeatureSetup } from '@/components/ProtectionFeatureSetup';
import { appI18n } from '@/i18n/runtime';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import * as Native from 'freed-protection';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
import { syncNativeAdultDomainFeed } from '@/lib/adult-domain-feed-sync';
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/lib/adult-domain-feed-sync', () => ({ syncNativeAdultDomainFeed: jest.fn() }));
jest.mock('freed-protection', () => ({
  applyAdultContentFilter: jest.fn(), requestProtectionAuthorization: jest.fn(), presentFamilyActivityPicker: jest.fn(),
  openUsageAccessSettings: jest.fn(), openProtectionSettings: jest.fn(), openPrivateDnsSettings: jest.fn(),
  openVpnSettings: jest.fn(), openSafariExtensionSettings: jest.fn(), getEncryptedDnsStatus: jest.fn(), configureEncryptedDns: jest.fn(),
}));
const ios: ProtectionCapability = { platform: 'ios', screenTime: false, managedSettings: false, accessibility: false, dnsFiltering: false, localVpnFallback: false, safariContentBlocker: true, notes: [] };
const android: ProtectionCapability = { ...ios, platform: 'android', accessibility: true, usageStats: true, localVpnFallback: true, dnsFiltering: true };
const off: ProtectionStatus = { authorized: false, active: false, mode: 'prototype', message: 'Not active' };
const dns = { supported: true, releaseEnabled: true, configured: false, enabled: false, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false };
function setup(intent: 'apps' | 'websites' = 'websites', capability = ios, status = off) {
  const refresh = jest.fn(async (): Promise<any> => ({ capability, status, readTicket: { revision: 1, isCurrent: () => true } })), close = jest.fn(), choose = jest.fn();
  const props = { intent, capability, status, appCount: 0, onRefresh: refresh, onChooseApps: choose, onSyncApps: jest.fn(), onClose: close, vpnDisclosureAcknowledged: false, onAcknowledgeVpnDisclosure: jest.fn() };
  return { refresh, close, choose, props, view: render(<ProtectionFeatureSetup {...props} />) };
}
beforeEach(async () => {
  await appI18n.changeLanguage('en');
  (AppState as any).currentState = 'active';
  (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({...dns,configured:true,enabled:true});
  (Native.configureEncryptedDns as jest.Mock).mockResolvedValue({ ...dns, configured: true, requiresSettings: true });
  jest.spyOn(Linking, 'openURL').mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());
test('iOS website setup exposes native DNS consent without requesting any permission or account on mount', async () => {
  (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue(dns);
  const { view, close } = setup();
  await act(async () => {});
  expect(view.getByTestId('dns-section')).toBeOnTheScreen();
  await act(async () => { fireEvent.press(view.getByTestId('website-open-advanced')); });
  expect(view.getByTestId('dns-consent-open')).not.toBeDisabled();
  expect(view.queryByTestId('feature-setup-continue')).toBeNull();
  expect(Native.configureEncryptedDns).not.toHaveBeenCalled();
  expect(Native.requestProtectionAuthorization).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('feature-setup-leave'));
  expect(close).toHaveBeenCalledTimes(1);
});
test('DNS save is configured only and a simulator never offers enablement', async () => {
  (Native.getEncryptedDnsStatus as jest.Mock).mockResolvedValue({ ...dns, supported: false, reason: 'ios-dns-simulator-unavailable' });
  const { view } = setup(); await act(async () => {});
  await act(async () => { fireEvent.press(view.getByTestId('website-open-advanced')); });
  expect(view.queryByTestId('dns-consent-open')).toBeNull();
  expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();
  expect(Native.configureEncryptedDns).not.toHaveBeenCalled();
});
test('safe browser tests open only on explicit user taps and never create a pass result', async () => {
  const { view } = setup(); await act(async () => {});
  expect(Linking.openURL).not.toHaveBeenCalled();
  await enterRecovery(view);
  fireEvent.press(view.getByTestId('website-test-toggle'));
  await act(async () => { fireEvent.press(view.getByTestId('website-test-adult')); });
  expect(Linking.openURL).toHaveBeenCalledWith('https://nudity.testcategory.com');
  await act(async () => { fireEvent.press(view.getByTestId('website-test-normal')); });
  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  expect(view.queryByText(/test passed/i)).toBeNull();
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
});
test('OS return refreshes status without an automatic permission request', async () => {
  const listeners: Array<(state: string) => void> = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.push(listener); return { remove: jest.fn() }; });
  const { refresh } = setup(); await act(async () => {});
  const previous = refresh.mock.calls.length;
  await act(async () => { listeners.forEach(listener => listener('active')); });
  expect(refresh.mock.calls.length).toBeGreaterThan(previous);
  expect(Native.getEncryptedDnsStatus).toHaveBeenCalledTimes(2);
  expect(Native.requestProtectionAuthorization).not.toHaveBeenCalled();
  expect(Native.configureEncryptedDns).not.toHaveBeenCalled();
});
test('Android feed fallback remains incomplete and gives a specific retryable message', async () => {
  (syncNativeAdultDomainFeed as jest.Mock).mockResolvedValue({ provider: 'embedded', warning: 'offline', status: off });
  const { view } = setup('websites', android);
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  expect(view.getByRole('alert')).toHaveTextContent(/offline fallback/);
  expect(view.getByTestId('feature-setup-continue')).not.toBeDisabled();
  expect(view.queryByRole('button', { name: 'Done' })).toBeNull();
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
});
test('app setup keeps websites and DNS optional and explains daily limits before any app selection', async () => {
  const { view } = setup('apps', android); await act(async () => {});
  expect(view.queryByTestId('dns-section')).toBeNull();
  expect(view.queryByTestId('website-test-adult')).toBeNull();
  expect(view.getByText(/Selecting an app does not block it immediately/)).toBeOnTheScreen();
  expect(Native.configureEncryptedDns).not.toHaveBeenCalled();
  expect(syncNativeAdultDomainFeed).not.toHaveBeenCalled();
});

test('Android explicit disclosure agreement proceeds to the native VPN request once', async () => {
  const status: ProtectionStatus = { ...off, adultDomainFeedVersion: 'reviewed-contract-v1', adultDomainFeedDomainCount: 100 };
  const { view } = setup('websites', android, status);
  await act(async () => { fireEvent.press(view.getByTestId('feature-setup-continue')); });
  expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Agree and continue' })); });
  expect(Native.applyAdultContentFilter).toHaveBeenCalledTimes(1);
});

async function enterRecovery(view: ReturnType<typeof render>) {
  await act(async()=>{fireEvent.press(view.getByTestId('website-configuration-check'));});
  fireEvent.press(view.getByTestId('website-safari-details'));
}
const recoveryReceipt = { ...off, safariExtensionSettingsOpened: true, safariExtensionSettingsTarget: 'focus-shield', safariExtensionSettingsRoute: 'extension' };
test('recovery settings are explicit, independent of blocker capability and never sync the adult feed', async () => {
  const { view, refresh } = setup('websites', { ...ios, safariContentBlocker: false }); await act(async () => {}); await enterRecovery(view);
  expect(view.getByTestId('website-safari-recovery')).toHaveTextContent(/FREED Focus Shield/);
  expect(view.getByTestId('website-safari-configuration-status')).toHaveTextContent('Not confirmed');
  expect(view.getByTestId('website-safari-recovery')).toHaveTextContent(/Blocking, browsing and Open Challenge remain unverified/);
  expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled();
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue(recoveryReceipt);
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(Native.openSafariExtensionSettings).toHaveBeenCalledWith('focus-shield');
  expect(syncNativeAdultDomainFeed).not.toHaveBeenCalled(); expect(refresh).toHaveBeenCalledTimes(3);
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
  expect(view.queryByText(/Recovery On/i)).toBeNull(); expect(Native.applyAdultContentFilter).not.toHaveBeenCalled();
});
test.each([
  { safariExtensionSettingsOpened: false, safariExtensionSettingsTarget: 'focus-shield', safariExtensionSettingsRoute: 'none', safariExtensionSettingsError: 'foreground-required', message: 'Not opened' },
  { safariExtensionSettingsOpened: true, safariExtensionSettingsTarget: 'content-blocker', safariExtensionSettingsRoute: 'extension' },
  { safariExtensionSettingsOpened: true, safariExtensionSettingsTarget: 'focus-shield', safariExtensionSettingsRoute: 'none' },
])('failed or mismatched Safari receipt gives repair and leaves retry usable: %j', async receipt => {
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue({ ...off, ...receipt });
  const { view } = setup(); await act(async () => {}); await enterRecovery(view);
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/could not open.*try again/i);
  expect(view.getByTestId('website-safari-recovery-setup')).not.toBeDisabled();
  expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Browsing test needed');
});
test.each(['native rejection', 'Native protection call "openSafariExtensionSettings" timed out after 20000ms.'])('Safari rejection/adapter timeout settles busy and can retry: %s', async message => {
  (Native.openSafariExtensionSettings as jest.Mock).mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce(recoveryReceipt);
  const { view } = setup(); await act(async () => {}); await enterRecovery(view);
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/could not open.*try again/i);
  expect(view.getByTestId('website-safari-recovery-setup')).not.toBeDisabled();
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
});
test('Safari fallback names FREED app settings and the remaining Focus Shield path', async () => {
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue({ ...recoveryReceipt, safariExtensionSettingsRoute: 'app-settings', safariExtensionSettingsError: 'direct-open-failed' });
  const { view } = setup(); await act(async () => {}); await enterRecovery(view);
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/FREED.*app settings.*Settings → Apps → Safari → Extensions → FREED Focus Shield/i);
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
});
test('Safari handoff guidance survives a final read failure without inventing verification', async () => {
  const { view, refresh } = setup(); await act(async () => {}); await enterRecovery(view);
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue(recoveryReceipt);
  refresh.mockRejectedValueOnce(new Error('readback failed'));
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/status could not refresh/i);
  expect(view.getByTestId('website-safari-recovery-setup')).not.toBeDisabled();
  expect(view.getByTestId('website-browsing-test-status')).toHaveTextContent('Browsing test needed');
});
test.each(['receipt', 'rejection'])('a late Safari %s is not published after an owner change and busy settles', async outcome => {
  let resolve!: (value: unknown) => void; let reject!: (error: Error) => void; let scope = 'owner-a';
  (Native.openSafariExtensionSettings as jest.Mock).mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
  const { view, props } = setup(); view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} />); await act(async () => {}); await enterRecovery(view);
  fireEvent.press(view.getByTestId('website-safari-recovery-setup'));
  expect(view.getByTestId('website-safari-recovery-setup')).toBeDisabled();
  scope = 'owner-b'; view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} />);
  await act(async () => { if (outcome === 'receipt') resolve(recoveryReceipt); else reject(new Error('late failure')); });
  expect(view.queryByTestId('website-safari-settings-feedback')).toBeNull();
  expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();
});
test('unmounted Safari action settles with a parent-fenced final read and no close', async () => {
  let resolve!: (value: unknown) => void;
  (Native.openSafariExtensionSettings as jest.Mock).mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
  const { view, refresh, close } = setup(); await act(async () => {}); await enterRecovery(view);
  fireEvent.press(view.getByTestId('website-safari-recovery-setup')); view.unmount();
  await act(async () => { resolve(recoveryReceipt); });
  expect(refresh).toHaveBeenCalledTimes(3); expect(close).not.toHaveBeenCalled();
});
test('stale blocker feed completion cannot open settings or start a new refresh for another owner', async () => {
  let finish!: () => void; let scope = 'owner-a';
  (syncNativeAdultDomainFeed as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const { view, props, refresh } = setup(); view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} />); await act(async () => {}); await enterRecovery(view);
  fireEvent.press(view.getByTestId('website-open-advanced')); fireEvent.press(view.getByTestId('website-safari-setup'));
  scope = 'owner-b'; view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} />);
  await act(async () => { finish(); });
  expect(Native.openSafariExtensionSettings).not.toHaveBeenCalled(); expect(refresh).toHaveBeenCalledTimes(2);
  expect(view.getByTestId('website-safari-setup')).not.toBeDisabled();
});


test.each([
  { capability: ios, status: null },
  { capability: null, status: off },
  { capability: null, status: null },
])('resolved missing Safari readback warns without losing the handoff: %j', async result => {
  const { view, refresh } = setup(); await act(async () => {}); await enterRecovery(view);
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue(recoveryReceipt);
  refresh.mockResolvedValueOnce(result as never);
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/status could not refresh/i);
  expect(view.getByTestId('website-safari-recovery-setup')).not.toBeDisabled();
});
test('null capability rerender keeps iOS fallback instructions without previous authorization or active facts', async () => {
  const enabled = { ...off, authorized: true, active: true, adultFilterActive: true, adultWebPolicyConfigured: true };
  const { view, refresh, props } = setup('websites', { ...ios, screenTime: true, managedSettings: true }, enabled); await act(async () => {}); await enterRecovery(view);
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue({ ...recoveryReceipt, safariExtensionSettingsRoute: 'app-settings' });
  refresh.mockImplementationOnce(async () => {
    view.rerender(<ProtectionFeatureSetup {...props} capability={null} status={null} />);
    return { capability: null, status: null } as never;
  });
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/FREED.*app settings.*Settings → Apps → Safari → Extensions → FREED Focus Shield/i);
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/status could not refresh/i);
  fireEvent.press(view.getByTestId('website-review-setup'));
  expect(view.getByTestId('website-screen-time-status')).toHaveTextContent(/^Not confirmed$/);
  expect(view.queryByTestId('feature-setup-continue')).toBeNull();
  expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();
  expect(view.getByTestId('website-review-browsing')).toHaveTextContent(/Browsing test needed/);
  expect(view.queryByTestId('website-safari-setup')).toBeNull();
});
test('null capability with retained status cannot retain previous enabled policy facts', async () => {
  const enabled = { ...off, authorized: true, adultFilterActive: true };
  const { view, props } = setup('websites', { ...ios, screenTime: true, managedSettings: true }, enabled); await act(async () => {}); await enterRecovery(view);
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue(recoveryReceipt);
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  view.rerender(<ProtectionFeatureSetup {...props} capability={null} status={enabled} />);
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
  fireEvent.press(view.getByTestId('website-review-setup'));
  expect(view.getByTestId('website-screen-time-status')).toHaveTextContent(/^Not confirmed$/);
  expect(view.queryByTestId('feature-setup-continue')).toBeNull();
  expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();
});
test('same-owner superseded null Safari read does not become a current read-failure warning', async () => {
  const { view, refresh } = setup(); await act(async () => {}); await enterRecovery(view);
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue(recoveryReceipt);
  refresh.mockResolvedValueOnce({ capability: null, status: null, superseded: true } as never);
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
  expect(view.getByTestId('website-safari-settings-feedback')).not.toHaveTextContent(/status could not refresh/i);
  expect(view.getByTestId('website-safari-recovery-setup')).not.toBeDisabled();
});
test.each(['owner-switch', 'unmount'])('late resolved missing readback cannot publish after %s', async boundary => {
  let finish!: (result: unknown) => void; let scope = 'owner-a';
  const { view, refresh, props } = setup(); view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} />); await act(async () => {}); await enterRecovery(view);
  (Native.openSafariExtensionSettings as jest.Mock).mockResolvedValue(recoveryReceipt);
  refresh.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }) as never);
  await act(async () => { fireEvent.press(view.getByTestId('website-safari-recovery-setup')); });
  expect(view.getByTestId('website-safari-settings-feedback')).toHaveTextContent(/enable.*website access/i);
  if (boundary === 'unmount') view.unmount();
  else { scope = 'owner-b'; view.rerender(<ProtectionFeatureSetup {...props} getActionScope={() => scope} capability={null} status={null} />); }
  await act(async () => { finish({ capability: null, status: null }); });
  if (boundary === 'owner-switch') {
    expect(view.queryByTestId('website-safari-settings-feedback')).toBeNull();
    expect(view.getByTestId('website-configuration-check')).not.toBeDisabled();
  }
  expect(refresh).toHaveBeenCalledTimes(3);
});
