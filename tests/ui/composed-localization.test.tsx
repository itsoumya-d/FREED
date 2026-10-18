import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Pressable, Text } from '@/components/Localized';
import { appI18n } from '@/i18n/runtime';
afterEach(async () => { await appI18n.changeLanguage('en'); });
test.each([['es', '2 minutos - medio'], ['de', '2 Min. - mittel'], ['ar', '٢ دقيقة - متوسط']])('composed duration and intensity remain localized in %s', async (language, expected) => {
  await appI18n.changeLanguage(language);
  const screen = render(<Text>{2}{' min - '}{'medium'}</Text>);
  expect(screen.getByText(expected)).toBeTruthy();
});
test('opaque private text opts out even when it equals an authored word', async () => {
  await appI18n.changeLanguage('es');
  const privateText = render(<Text translate={false} accessibilityLabel="Calm">Calm</Text>);
  expect(privateText.getByText('Calm')).toBeTruthy();
  expect(privateText.getByLabelText('Calm')).toBeTruthy();
});

test('body text defaults to 17 points while a caller title size remains intact', () => {
  const body = render(<Text testID="body-default">Today</Text>);
  expect(StyleSheet.flatten(body.getByTestId('body-default').props.style).fontSize).toBe(17);
  const title = render(<Text testID="title-large" style={{ fontSize: 32 }}>Today</Text>);
  expect(StyleSheet.flatten(title.getByTestId('title-large').props.style).fontSize).toBe(32);
});

test('private pressable accessibility labels and hints opt out of authored source translation', async () => {
  await appI18n.changeLanguage('fr');
  const screen = render(<Pressable testID="private-reset" translate={false} accessibilityLabel="Exercise, 2 minutes" accessibilityHint="Exercise"><Text translate={false}>Exercise</Text></Pressable>);
  expect(screen.getByTestId('private-reset').props.accessibilityLabel).toBe('Exercise, 2 minutes');
  expect(screen.getByTestId('private-reset').props.accessibilityHint).toBe('Exercise');
});
