import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecoveryHero } from '@/components/RecoveryHero';
import { appI18n } from '@/i18n/runtime';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@react-navigation/native', () => ({ NavigationContext: require('react').createContext(null) }));
const mockGreet = jest.fn();
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: ({ interactive }: { interactive: boolean }) => {
  const React = require('react'); const { Pressable, Text } = require('react-native');
  return React.createElement(Pressable, { testID: 'interactive-companion-action', accessible: interactive, accessibilityRole: 'button', accessibilityLabel: 'Say hi to the companion', onPress: mockGreet }, React.createElement(Text, null, 'Companion'));
} }));
beforeEach(async () => { await appI18n.changeLanguage('en'); mockGreet.mockClear(); });
test('interactive companion is reachable while real recorded values and progress navigation remain', () => {
  const onProgress = jest.fn();
  const screen = render(<RecoveryHero days={3} elapsed="3 days" milestone="Next milestone · 7 days" progress={3 / 7} onProgress={onProgress} />);
  fireEvent.press(screen.getByTestId('interactive-companion-action'));
  expect(mockGreet).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('home-streak-days')).toHaveTextContent('3 days');
  fireEvent.press(screen.getByTestId('recovery-hero'));
  expect(onProgress).toHaveBeenCalledTimes(1);
});
