import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import RootLayout from '../../app/_layout';
import PreferencesRoute from '../../app/preferences';
import { appI18n } from '@/i18n/runtime';
import { getAppPalette } from '@/design-system/app-palette';

let mockMode: 'light' | 'dark' = 'light';
let mockCanGoBack = true;
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('@/lib/runtime-polyfills', () => ({}));
jest.mock('@/lib/monetization', () => ({ configureNativeMonetizationBuild: jest.fn() }));
jest.mock('@/features/freed-app', () => ({ FreedAppProvider: ({ children }: any) => children }));
jest.mock('@/hooks/use-app-preferences', () => ({
  AppPreferencesProvider: ({ children }: any) => children,
  useAppPreferences: () => ({ mode: mockMode }),
}));
jest.mock('@/components/PreferencesScreen', () => ({ PreferencesScreen: (props: any) => require('react').createElement(require('react-native').View, { testID: 'preferences-body-options', ...props }) }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stack = ({ children, screenOptions }: any) => React.createElement(View, { testID: 'native-stack-options', screenOptions }, children);
  Stack.Screen = ({ name, options }: any) => React.createElement(View, { testID: name ? `route-${name}` : 'route-options', options });
  return { Stack, useRouter: () => ({ canGoBack: () => mockCanGoBack, back: mockBack, replace: mockReplace }) };
});
jest.mock('expo-router/stack', () => ({ Stack: require('expo-router').Stack }));

beforeEach(async () => {
  mockCanGoBack = true;
  mockMode = 'light';
  await appI18n.changeLanguage('en');
});

function localized(element: React.ReactElement) {
  return <I18nextProvider i18n={appI18n}>{element}</I18nextProvider>;
}

test.each(['light', 'dark'] as const)('%s preferences retains its original native form sheet, shared theme and native header', mode => {
  mockMode = mode;
  const screen = render(localized(<RootLayout />));
  const options = screen.getByTestId('route-preferences').props.options;
  expect(options.presentation).toBe('formSheet');
  expect(options.headerShown).toBe(true);
  expect(options.title).toBe('Preferences');
  expect(options.sheetAllowedDetents).toEqual([1]);
  expect(options.sheetGrabberVisible).toBe(true);
  expect(options.contentStyle).toBeUndefined();
  // The blank overlay came from journey redirection, not formSheet sizing.
  // Retain shared theming without the disproved percentage-height workaround.
  const sharedOptions = screen.getByTestId('native-stack-options').props.screenOptions;
  expect(StyleSheet.flatten(sharedOptions.contentStyle)).toEqual({ backgroundColor: getAppPalette(mode).bg });
});

test('native Done delegates to the existing navigator back without choosing a replacement destination', () => {
  const route = render(localized(<PreferencesRoute />));
  const options = route.getByTestId('route-options').props.options;
  const header = render(options.headerRight({ tintColor: getAppPalette('light').text }));
  const done = header.getByRole('button', { name: 'Done' });
  expect(StyleSheet.flatten(done.props.style)).toEqual(expect.objectContaining({ minWidth: 44, minHeight: 44 }));
  fireEvent.press(done);
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('cold preferences deep link has a safe root fallback for Done', () => {
  mockCanGoBack = false;
  const route = render(localized(<PreferencesRoute />));
  const header = render(route.getByTestId('route-options').props.options.headerRight({ tintColor: getAppPalette('light').text }));
  fireEvent.press(header.getByRole('button', { name: 'Done' }));
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith('/');
});

const publicRoutes = [
  ['privacy', 'FREED Privacy Policy'],
  ['support', 'FREED Support'],
  ['account-deletion', 'FREED Account Deletion'],
] as const;

test.each(publicRoutes)('%s exposes a native header and accessible themed Done without replacing native Back', (name, title) => {
  const screen = render(localized(<RootLayout />));
  const options = screen.getByTestId(`route-${name}`).props.options;
  expect(options.headerShown).toBe(true);
  expect(options.title).toBe(title);
  expect(options.headerLeft).toBeUndefined();
  expect(options.headerBackVisible).not.toBe(false);
  expect(options.presentation).toBeUndefined();
  const header = render(localized(options.headerRight({ tintColor: '#123456' })));
  const done = header.getByRole('button', { name: 'Done' });
  expect(StyleSheet.flatten(done.props.style)).toEqual(expect.objectContaining({ minWidth: 44, minHeight: 44 }));
  expect(header.getByText('Done')).toHaveStyle({ color: '#123456' });
  fireEvent.press(done);
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});

test.each(publicRoutes)('cold %s Done falls back to root instead of forcing a journey destination', name => {
  mockCanGoBack = false;
  const screen = render(localized(<RootLayout />));
  const options = screen.getByTestId(`route-${name}`).props.options;
  const header = render(localized(options.headerRight({ tintColor: '#123456' })));
  fireEvent.press(header.getByRole('button', { name: 'Done' }));
  expect(mockBack).not.toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/');
});

test('public headers update their existing title translations and Done in place', async () => {
  const screen = render(localized(<RootLayout />));
  await require('@testing-library/react-native').act(async () => { await appI18n.changeLanguage('ja'); });
  for (const [name, title] of [
    ['privacy', 'FREEDプライバシーポリシー'],
    ['support', 'FREEDサポート'],
    ['account-deletion', 'FREEDアカウントの削除'],
  ]) {
    const options = screen.getByTestId(`route-${name}`).props.options;
    expect(options.title).toBe(title);
    const header = render(localized(options.headerRight({ tintColor: '#123456' })));
    expect(header.getByRole('button', { name: '完了' })).toBeOnTheScreen();
    header.unmount();
  }
});

test('public headers leave root, tabs, onboarding, flow and Preferences presentation unchanged', () => {
  const screen = render(localized(<RootLayout />));
  expect(screen.getByTestId('native-stack-options').props.screenOptions.headerShown).toBe(false);
  expect(screen.getByTestId('route-index').props.options).toBeUndefined();
  expect(screen.getByTestId('route-(tabs)').props.options).toBeUndefined();
  expect(screen.getByTestId('route-onboarding/[destination]').props.options).toEqual({ gestureEnabled: true });
  const flowOptions = screen.getByTestId('route-flow/[destination]').props.options;
  for (const [destination, presentation] of [['account', 'modal'], ['breathing', 'fullScreenModal'], ['journal', 'modal'], ['unknown', 'card']]) {
    expect(flowOptions({ route: { params: { destination } } })).toEqual({ presentation });
  }
  expect(screen.getByTestId('route-preferences').props.options).toEqual({ presentation: 'formSheet', headerShown: true, title: 'Preferences', sheetGrabberVisible: true, sheetAllowedDetents: [1] });
});


test('Preferences route tells the body that its title belongs to the native navigator', () => {
  const route = render(localized(<PreferencesRoute />));
  expect(route.getByTestId('preferences-body-options')).toHaveProp('nativeHeader', true);
});
