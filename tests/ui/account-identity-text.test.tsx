jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { Platform, StyleSheet } from 'react-native';
import { AccountAccessScreen } from '@/components/AccountAccessScreen';
import { AccountReauthenticationScreen } from '@/components/AccountReauthenticationScreen';
import { appI18n, translateSource } from '@/i18n/runtime';

let mockAccount = { signedIn: false, anonymous: false, email: null as string | null, providers: [] as string[], emailVerified: false };
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/components/SocialSignInButtons', () => ({ SocialSignInButtons: () => null }));
jest.mock('lucide-react-native', () => ({ ChevronDown: () => null, Eye: () => null, EyeOff: () => null, Mail: () => null, Shield: () => null, ArrowLeft: () => null, ArrowRight: () => null }));
jest.mock('@/lib/social-login', () => ({ isAppleSignInAvailable: async () => false, isGoogleSignInConfigured: () => false }));
jest.mock('@/lib/firebase-native', () => ({
  startFirebaseClient: async () => ({ status: 'started' }),
  getFirebaseAccountSummary: () => mockAccount,
  getFirebaseAccountScope: () => mockAccount.signedIn ? 'fixture-account-identity' : null,
  getFirebaseNativeAuthAdapter: () => ({ requestPasswordReset: async () => ({ ok: true }) })
}));
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockAccount = { signedIn: false, anonymous: false, email: null, providers: [], emailVerified: false };
  await appI18n.changeLanguage('ar');
});
afterEach(async () => { await appI18n.changeLanguage('en'); });

test('password reset confirmation preserves email data and its natural direction across language changes', async () => {
  const address = 'calm@example.com';
  const screen = render(<I18nextProvider i18n={appI18n}><AccountAccessScreen initialEmail={address} onConnected={jest.fn()} onSkip={jest.fn()} /></I18nextProvider>);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: translateSource('Sign in with email') })); });
  await fireEvent.press(screen.getByRole('button', { name: translateSource('Forgot password?') }));
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: translateSource('Send reset email') })); });
  expect(screen.getByText(address).props.children).toBe(address);
  expect(StyleSheet.flatten(screen.getByText(address).props.style).writingDirection).toBe('auto');
  await act(async () => { await appI18n.changeLanguage('de'); });
  expect(screen.getByText(address).props.children).toBe(address);
});

test('account deletion confirmation treats the existing email as opaque identity and leaves Cancel reachable', async () => {
  const address = 'Calm@example.com';
  mockAccount = { signedIn: true, anonymous: false, email: address, providers: ['password'], emailVerified: true };
  const cancel = jest.fn(); const confirmed = jest.fn();
  const screen = render(<I18nextProvider i18n={appI18n}><AccountReauthenticationScreen onConfirmed={confirmed} onCancel={cancel} /></I18nextProvider>);
  expect(screen.getByText(address).props.children).toBe(address);
  expect(StyleSheet.flatten(screen.getByText(address).props.style).writingDirection).toBe('auto');
  await fireEvent.press(screen.getByRole('button', { name: translateSource('Cancel') }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(confirmed).not.toHaveBeenCalled();
});
