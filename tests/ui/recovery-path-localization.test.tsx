import React from 'react';
import { render } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { RecoveryPath } from '@/components/RecoveryPath';
import { appI18n, localizedNumber, translateSource } from '@/i18n/runtime';
import { SUPPORTED_LANGUAGES } from '@/lib/app-preferences';

let mockMode: 'light' | 'dark' = 'light';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }) }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@react-navigation/native', () => ({ NavigationContext: require('react').createContext(null) }));
jest.mock('expo-haptics', () => ({ selectionAsync: async () => undefined, impactAsync: async () => undefined, notificationAsync: async () => undefined }));
afterEach(async () => { await appI18n.changeLanguage('en'); });

test.each(SUPPORTED_LANGUAGES.flatMap(language => (['light', 'dark'] as const).map(mode => [language, mode] as const)))('%s %s announces the localized active step and progress instead of a joined English paragraph', async (language, mode) => {
  mockMode = mode;
  await appI18n.changeLanguage(language);
  const screen = render(<I18nextProvider i18n={appI18n}><RecoveryPath progress={0.5} activeStage={1} /></I18nextProvider>);
  const label = screen.getByRole('image').props.accessibilityLabel;
  expect(label).toContain(translateSource('Recovery path.', language));
  expect(label).toContain(appI18n.t('source.Current step {{value1}} of 3: {{value2}}.', {
    value1: localizedNumber(2), value2: translateSource('Protect', language)
  }));
  expect(label).toContain(appI18n.t('source.Plan progress {{value1}} percent.', { value1: localizedNumber(50) }));
  if (language !== 'en') expect(label).not.toContain('Current step');
  screen.rerender(<I18nextProvider i18n={appI18n}><RecoveryPath progress={1} activeStage={2} /></I18nextProvider>);
  expect(screen.getByRole('image').props.accessibilityLabel).toContain(translateSource('Practice', language));
});
