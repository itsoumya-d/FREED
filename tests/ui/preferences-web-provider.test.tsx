import React from 'react';
import { Platform, Appearance, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AppPreferencesProvider, useAppPreferences } from '@/hooks/use-app-preferences';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
function Probe() { const { mode } = useAppPreferences(); return <Text>{mode}</Text>; }
test('web mounts when the browser Appearance API has no native setter', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  Object.defineProperty(Appearance, 'setColorScheme', { configurable: true, value: undefined });
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) } });
  const screen = render(<AppPreferencesProvider><Probe /></AppPreferencesProvider>);
  expect(screen.getByText('light')).toBeTruthy();
});
