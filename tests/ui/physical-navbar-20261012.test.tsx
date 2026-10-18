import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import { RootToolbarActions } from '@/components/RootToolbarActions';
import { appI18n, localeResources, translateSource } from '@/i18n/runtime';
import TodayStack from '../../app/(tabs)/today/_layout';
import ShieldStack from '../../app/(tabs)/shield/_layout';
import ProgressStack from '../../app/(tabs)/progress/_layout';
import ProfileStack from '../../app/(tabs)/profile/_layout';

const mockPush = jest.fn(), mockHelp = jest.fn();
let mockMode = 'light';
jest.mock('@/features/freed-app', () => ({ useFreedAppController: () => ({ startPanicIntervention: mockHelp }) }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }) }));
jest.mock('lucide-react-native', () => ({ Globe2: () => null, LifeBuoy: () => null }));
jest.mock('expo-router', () => {
  const React = require('react'); const { View } = require('react-native');
  const Stack = ({ children, screenOptions }: any) => React.createElement(View, { testID: 'stack', screenOptions }, children);
  Stack.Screen = ({ name, options }: any) => React.createElement(View, { testID: `route-${name}`, options });
  return { Stack, useRouter: () => ({ push: mockPush }) };
});
beforeEach(async () => { mockMode = 'light'; await appI18n.changeLanguage('en'); });
afterEach(async () => { await appI18n.changeLanguage('en'); });

test.each(Object.keys(localeResources).flatMap(language => ['light', 'dark'].map(mode => ({ language, mode }))))('native controls remain individually named and actionable in $language/$mode', async ({ language, mode }) => {
  mockMode = mode; await appI18n.changeLanguage(language);
  const layout = render(<TodayStack />);
  const options = layout.getByTestId('route-index').props.options;
  expect(options.unstable_headerRightItems).toEqual(expect.any(Function));
  const items = options.unstable_headerRightItems({ canGoBack: false });
  expect(items).toHaveLength(2);
  for (const item of items) expect(item).toMatchObject({ type: 'custom', hidesSharedBackground: true });
  const left = options.unstable_headerLeftItems({ canGoBack: false });
  expect(left).toHaveLength(1); expect(left[0]).toMatchObject({ type: 'custom', hidesSharedBackground: true });
  const controls = render(<View>{items.map((item: any, index: number) => <React.Fragment key={index}>{item.element}</React.Fragment>)}</View>);
  const languageButton = controls.getByRole('button', { name: appI18n.t('preferences.language') });
  expect(languageButton).toHaveStyle({ minWidth: 44, minHeight: 44 });
  expect(controls.getByText(language.split('-')[0].toUpperCase())).toBeOnTheScreen();
  const support = controls.getByRole('button', { name: translateSource('Help now: open urge support') });
  expect(support).toHaveStyle({ minWidth: 44, minHeight: 44 });
  expect(controls.queryByText(translateSource('Help now'))).toBeNull();
  expect(support.props.accessibilityHint).toBe(translateSource('Opens immediate recovery support without an ad.'));
  fireEvent.press(languageButton); expect(mockPush).toHaveBeenCalledWith('/preferences'); expect(mockHelp).not.toHaveBeenCalled();
  fireEvent.press(support); expect(mockHelp).toHaveBeenCalledTimes(1);
});

test.each([TodayStack, ShieldStack, ProgressStack, ProfileStack])('each tab uses the native custom-item API and keeps the fallback header', TabStack => {
  const layout = render(<TabStack />); const options = layout.getByTestId('route-index').props.options;
  const shared = layout.getByTestId('stack').props.screenOptions;
  const actions = options.unstable_headerRightItems ?? shared.unstable_headerRightItems;
  expect(actions).toEqual(expect.any(Function)); expect(actions({ canGoBack: true })).toHaveLength(2);
  const fallback = options.headerRight ?? shared.headerRight;
  const controls = render(fallback({ canGoBack: true }));
  fireEvent.press(controls.getByRole('button', { name: 'Help now: open urge support' })); expect(mockHelp).toHaveBeenCalledTimes(1);
  expect(shared.headerLeft).toBeUndefined(); expect(shared.unstable_headerLeftItems).toBeUndefined();
  const detail = layout.queryByTestId('route-[section]');
  if (detail) {
    const detailOptions = detail.props.options({ route: { params: { section: 'details' } } });
    expect(detailOptions.headerLeft).toBeUndefined(); expect(detailOptions.unstable_headerLeftItems).toBeUndefined();
    expect(detailOptions.title).not.toBe(''); expect(shared.headerBackButtonDisplayMode).toBe('minimal');
  }
});

test('non-iOS fallback preserves complete Help text and language route', () => {
  const controls = render(<RootToolbarActions />);
  expect(controls.getByText('Help now')).toBeOnTheScreen();
  fireEvent.press(controls.getByTestId('root-language')); expect(mockPush).toHaveBeenCalledWith('/preferences');
  fireEvent.press(controls.getByRole('button', { name: 'Help now: open urge support' })); expect(mockHelp).toHaveBeenCalledTimes(1);
});
