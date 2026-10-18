jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
import React from 'react';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
import { render, fireEvent, act } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';
import { EncryptedDnsSection } from '@/components/EncryptedDnsSection';
import { appI18n } from '@/i18n/runtime';
import { configureEncryptedDns, getEncryptedDnsStatus } from 'freed-protection';
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(effect, [effect]) }));
jest.mock('freed-protection', () => ({ configureEncryptedDns: jest.fn(), getEncryptedDnsStatus: jest.fn(), openProtectionSettings: jest.fn().mockResolvedValue(undefined), openVpnSettings: jest.fn().mockResolvedValue(undefined) }));
const off = { supported: true, releaseEnabled: true, configured: false, enabled: false, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false };
const active = { ...off, configured: true, enabled: true, healthy: true };
test('older DNS refresh cannot resurrect active after pause completes', async () => {
 await act(async () => { await appI18n.changeLanguage('en'); });
 (getEncryptedDnsStatus as jest.Mock).mockResolvedValue(active);
 const screen = render(<I18nextProvider i18n={appI18n}><EncryptedDnsSection /></I18nextProvider>);
 await act(async () => {});
 let oldRefresh!: (s: typeof active) => void;
 (getEncryptedDnsStatus as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { oldRefresh = resolve; }));
 fireEvent.press(screen.getByTestId('dns-refresh'));
 (configureEncryptedDns as jest.Mock).mockImplementation(async () => {
   (getEncryptedDnsStatus as jest.Mock).mockResolvedValue(off);
   return off;
 });
 await act(async () => { fireEvent.press(screen.getByTestId('dns-pause')); });
 expect(screen.getByTestId('dns-status')).toHaveTextContent(appI18n.t('dns.off'));
 await act(async () => { oldRefresh(active); });
 expect(screen.getByTestId('dns-status')).toHaveTextContent(appI18n.t('dns.off'));
});

test('language/focus changes during DNS enable keep the operation and reconcile actual settings', async () => {
 await act(async () => { await appI18n.changeLanguage('en'); });
 (getEncryptedDnsStatus as jest.Mock).mockResolvedValue(off);
 let finish!: (status: typeof active) => void;
 (configureEncryptedDns as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
 const screen = render(<I18nextProvider i18n={appI18n}><EncryptedDnsSection /></I18nextProvider>);
 await act(async () => {});
 fireEvent.press(screen.getByTestId('dns-consent-open'));
 await act(async () => { fireEvent.press(screen.getByTestId('dns-consent-accept')); });
 await act(async () => { await appI18n.changeLanguage('hi'); });
 (getEncryptedDnsStatus as jest.Mock).mockResolvedValue(active);
 await act(async () => { finish(active); });
 expect(screen.getByTestId('dns-status')).toHaveTextContent(appI18n.t('dns.active'));
 expect(screen.queryByTestId('dns-consent')).toBeNull();
 await act(async () => { await appI18n.changeLanguage('en'); });
});
