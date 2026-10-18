import React from 'react';
import { Button, Platform, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AppPreferencesProvider, useAppPreferences } from '@/hooks/use-app-preferences';
import { setProtectionPresentationPreferences } from 'freed-protection';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('freed-protection', () => ({ setProtectionPresentationPreferences: jest.fn(() => true) }));
function Probe() {
  const { language, update } = useAppPreferences();
  return <><Text>{language}</Text><Button title="change" onPress={() => update({ language: 'en', themeMode: 'light' })} /></>;
}
test('native blocking-screen preferences receive restored and newly selected settings', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  const saved = new Map([['freed.preferences.v1', JSON.stringify({ language: 'ko', themeMode: 'dark' })]]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) } });
  const screen = render(<AppPreferencesProvider><Probe /></AppPreferencesProvider>);
  expect(screen.getByText('ko')).toBeTruthy();
  expect(setProtectionPresentationPreferences).toHaveBeenLastCalledWith({ language: 'ko', themeMode: 'dark', languagePreference: 'ko' });
  fireEvent.press(screen.getByText('change'));
  expect(screen.getByText('en')).toBeTruthy();
  expect(setProtectionPresentationPreferences).toHaveBeenLastCalledWith({ language: 'en', themeMode: 'light', languagePreference: 'en' });
});
