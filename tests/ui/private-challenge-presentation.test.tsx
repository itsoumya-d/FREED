import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChallengeOption, ChallengeText } from '@/components/ChallengePresentation';
import { appI18n, translateSource } from '@/i18n/runtime';
beforeEach(async () => { await appI18n.changeLanguage('fr'); });
afterEach(async () => { await appI18n.changeLanguage('en'); });
test('custom title and steps stay verbatim in visible and spoken content', () => {
  const onPress = jest.fn();
  const screen = render(<ChallengeOption title="Exercise" minutes={1} custom onPress={onPress}><ChallengeText custom testID="private-title">Exercise</ChallengeText><ChallengeText custom testID="private-step">Exhale</ChallengeText></ChallengeOption>);
  expect(screen.getByTestId('private-title')).toHaveTextContent('Exercise');
  expect(screen.getByTestId('private-step')).toHaveTextContent('Exhale');
  const label = screen.getByRole('button').props.accessibilityLabel;
  expect(label).toContain('Exercise'); expect(label).not.toContain('Exercice');
  fireEvent.press(screen.getByRole('button')); expect(onPress).toHaveBeenCalledTimes(1);
});
test('authored challenge titles retain the locale bridge', () => {
  const screen = render(<ChallengeOption title="Exercise" minutes={2} custom={false} onPress={() => undefined}><ChallengeText custom={false} testID="authored-title">Exercise</ChallengeText></ChallengeOption>);
  expect(screen.getByTestId('authored-title')).toHaveTextContent(translateSource('Exercise'));
  expect(screen.getByRole('button').props.accessibilityLabel).toContain(translateSource('Exercise'));
});
