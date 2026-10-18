jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
import React from 'react';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { configureEncryptedDns, getEncryptedDnsStatus } from 'freed-protection';
import { EncryptedDnsSection } from '@/components/EncryptedDnsSection';
import { appI18n } from '@/i18n/runtime';
import { unavailableEncryptedDnsStatus, type EncryptedDnsStatus } from '@/lib/encrypted-dns';

jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(effect, [effect]) }));
jest.mock('freed-protection', () => ({ configureEncryptedDns: jest.fn(), getEncryptedDnsStatus: jest.fn(), openProtectionSettings: jest.fn().mockResolvedValue(undefined), openVpnSettings: jest.fn().mockResolvedValue(undefined) }));

const supportedStatus = (patch: Partial<EncryptedDnsStatus> = {}): EncryptedDnsStatus => ({ supported: true, releaseEnabled: true, configured: false, enabled: false, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false, ...patch });
async function section(status: EncryptedDnsStatus) {
  (getEncryptedDnsStatus as jest.Mock).mockResolvedValue(status);
  const screen = render(<I18nextProvider i18n={appI18n}><EncryptedDnsSection /></I18nextProvider>);
  await act(async () => {});
  return screen;
}
beforeEach(async () => {
  await appI18n.changeLanguage('en');
  (configureEncryptedDns as jest.Mock).mockImplementation(async ({enabled}) => {
    const next = supportedStatus(enabled ? { configured: true, requiresSettings: true } : {});
    (getEncryptedDnsStatus as jest.Mock).mockResolvedValue(next);
    return next;
  });
});

test('missing native capability and release-gated builds never enable DNS or report protection active', async () => {
  const screen = await section(unavailableEncryptedDnsStatus('encrypted-dns-release-gated'));
  expect(screen.getByTestId('dns-consent-open')).toBeDisabled();
  expect(screen.getByTestId('dns-status')).not.toHaveTextContent(appI18n.t('dns.active'));
  await fireEvent.press(screen.getByTestId('dns-consent-open'));
  expect(screen.queryByTestId('dns-consent')).toBeNull();
  expect(configureEncryptedDns).not.toHaveBeenCalled();
});

test('consent disclosure can be declined without any native DNS configuration', async () => {
  const screen = await section(supportedStatus());
  expect(configureEncryptedDns).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('dns-consent-open'));
  expect(screen.getByTestId('dns-consent')).toBeOnTheScreen();
  expect(screen.getByText(appI18n.t('dns.consentBody'))).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('dns-consent-cancel'));
  expect(screen.queryByTestId('dns-consent')).toBeNull();
  expect(configureEncryptedDns).not.toHaveBeenCalled();
});

test('consent acceptance configures the reviewed provider without inferring enabled protection', async () => {
  const screen = await section(supportedStatus());
  await fireEvent.press(screen.getByTestId('dns-consent-open'));
  await act(async () => { fireEvent.press(screen.getByTestId('dns-consent-accept')); });
  expect(configureEncryptedDns).toHaveBeenCalledWith({ enabled: true, provider: 'cloudflare-families' });
  expect(screen.queryByTestId('dns-consent')).toBeNull();
  expect(screen.getByTestId('dns-status')).toHaveTextContent(appI18n.t('dns.configured'));
  expect(screen.getByTestId('dns-status')).not.toHaveTextContent(appI18n.t('dns.active'));
  expect(screen.getByTestId('dns-settings')).toBeOnTheScreen();
});

test.each([
  [null, 'unverified'],
  [false, 'limited'],
  [true, 'active'],
] as const)('enabled status with health %s renders only the corresponding native state', async (healthy, key) => {
  const screen = await section(supportedStatus({ configured: true, enabled: true, healthy }));
  expect(screen.getByTestId('dns-status')).toHaveTextContent(appI18n.t(`dns.${key}`));
});

test('native refresh failure removes a previously active claim and permits a later retry', async () => {
  const screen = await section(supportedStatus({ configured: true, enabled: true, healthy: true }));
  expect(screen.getByTestId('dns-status')).toHaveTextContent(appI18n.t('dns.active'));
  (getEncryptedDnsStatus as jest.Mock).mockRejectedValueOnce(new Error('native status unavailable'));
  await act(async () => { fireEvent.press(screen.getByTestId('dns-refresh')); });
  expect(screen.getByTestId('dns-status')).not.toHaveTextContent(appI18n.t('dns.active'));
  (getEncryptedDnsStatus as jest.Mock).mockResolvedValue(supportedStatus({ configured: true, enabled: true, healthy: true }));
  await act(async () => { fireEvent.press(screen.getByTestId('dns-refresh')); });
  await waitFor(() => expect(screen.getByTestId('dns-status')).toHaveTextContent(appI18n.t('dns.active')));
});

test('pause waits for native confirmation and prevents duplicate operations', async () => {
  const screen = await section(supportedStatus({ configured: true, enabled: true, healthy: true }));
  let complete!: (status: EncryptedDnsStatus) => void;
  (configureEncryptedDns as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  await fireEvent.press(screen.getByTestId('dns-pause'));
  expect(screen.getByTestId('dns-pause')).toBeDisabled();
  await fireEvent.press(screen.getByTestId('dns-pause'));
  expect(configureEncryptedDns).toHaveBeenCalledTimes(1);
  expect(configureEncryptedDns).toHaveBeenCalledWith({ enabled: false, provider: 'cloudflare-families' });
  await act(async () => { (getEncryptedDnsStatus as jest.Mock).mockResolvedValue(supportedStatus()); complete(supportedStatus()); });
  expect(screen.queryByTestId('dns-pause')).toBeNull();
  expect(screen.getByTestId('dns-status')).not.toHaveTextContent(appI18n.t('dns.active'));
});

test('configured, OS enabled and network verification are reported independently', async () => {
 const screen=await section(supportedStatus({configured:true,enabled:false,requiresSettings:true}));
 fireEvent.press(screen.getByTestId('dns-details'));
 expect(screen.getByTestId('dns-configuration-state')).toHaveTextContent('Configuration saved');
 expect(screen.getByTestId('dns-os-state')).toHaveTextContent('Not enabled in system settings');
 expect(screen.getByTestId('dns-network-state')).toHaveTextContent('Network blocking not verified');
 screen.unmount();
 const enabled=await section(supportedStatus({configured:true,enabled:true,healthy:null}));
 fireEvent.press(enabled.getByTestId('dns-details'));
 expect(enabled.getByTestId('dns-os-state')).toHaveTextContent('Enabled in system settings');
 expect(enabled.getByTestId('dns-network-state')).toHaveTextContent('Network blocking not verified');
 expect(enabled.getByTestId('dns-status')).not.toHaveTextContent(appI18n.t('dns.active'));
});
test('a failed native network health report remains degraded despite OS enablement', async () => {
 const screen=await section(supportedStatus({configured:true,enabled:true,healthy:false}));
 fireEvent.press(screen.getByTestId('dns-details'));
 expect(screen.getByTestId('dns-os-state')).toHaveTextContent('Enabled in system settings');
 expect(screen.getByTestId('dns-network-state')).toHaveTextContent('Network check needs attention');
 expect(screen.getByTestId('dns-status')).not.toHaveTextContent(appI18n.t('dns.active'));
});
