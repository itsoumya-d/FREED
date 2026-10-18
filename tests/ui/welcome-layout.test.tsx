import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
import { getAppPalette } from '@/design-system/app-palette';

// Run the actual locally scoped production screen with inert shell boundaries.
// This avoids importing the unrelated native protection/account runtime.
const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`, 'utf8');
const start = source.indexOf('function WelcomeScreen(');
const end = source.indexOf('\nfunction QuizScreen(', start);
const compiled = transpileModule(`${source.slice(start, end)}\nexports.WelcomeScreen = WelcomeScreen;`, { compilerOptions: { jsx: JsxEmit.React, module: ModuleKind.CommonJS } }).outputText;
let mockDimensions = { height: 667, width: 375, fontScale: 1 };
let mockMode: 'light' | 'dark' = 'light';
const DeviceLanguageContext = React.createContext('en');
const dependencies = {
  React, useTranslation, useAppTheme: () => { React.useContext(DeviceLanguageContext); return { colors: getAppPalette(mockMode) }; },
  useWindowDimensions: () => mockDimensions,
  appI18n, AppBackground: View, SafeAreaView: View, ScrollView: require('react-native').ScrollView,
  View, Text, Pressable,
  BrandLogo: () => <Text>FREED</Text>,
  OnboardingPreferences: () => <Pressable testID="onboarding-language" accessibilityRole="button"><Text>Language</Text></Pressable>,
  MomentumCompanion: ({ width, height }: { width: number; height: number }) => <View testID="welcome-illustration" style={{ width, height }} />,
  PillButton: ({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) => <Pressable testID={testID} accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>,
};
const compiledExports: { WelcomeScreen?: React.ComponentType<{ onStart: () => void; onSkip: () => void }> } = {};
new Function('exports', ...Object.keys(dependencies), compiled)(compiledExports, ...Object.values(dependencies));
const WelcomeScreen = compiledExports.WelcomeScreen!;
beforeEach(async () => { mockMode = 'light'; mockDimensions = { height: 667, width: 375, fontScale: 1 }; await appI18n.changeLanguage('en'); });

test('first-use primary entry runs its actual callback and existing-account entry uses the separate callback', () => {
  const start = jest.fn(), personalize = jest.fn();
  const view = render(<WelcomeScreen onStart={start} onSkip={personalize} />);
  expect(view.getByTestId('onboarding-language')).toBeOnTheScreen();
  expect(view.getByText('Set app limits. Complete a reset, then request a 5- or 10-minute app break.')).toBeOnTheScreen();
  fireEvent.press(view.getByTestId('onboarding-start'));
  expect(start).toHaveBeenCalledTimes(1);
  expect(personalize).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('onboarding-personalize'));
  expect(personalize).toHaveBeenCalledTimes(1);
  expect(view.getByText('For adults 18+. Account required. Basic help included.')).toBeOnTheScreen();
});

test('SE viewport allocates a compact illustration while keeping readable purpose and actions in the scroll container', () => {
  const view = render(<WelcomeScreen onStart={jest.fn()} onSkip={jest.fn()} />);
  fireEvent(view.getByTestId('welcome-content'), 'layout', { nativeEvent: { layout: { height: 603 } } });
  expect(StyleSheet.flatten(view.getByTestId('welcome-illustration').props.style).height).toBe(96);
  const container = StyleSheet.flatten(view.getByTestId('welcome-content').props.contentContainerStyle);
  expect(container).toMatchObject({ flexGrow: 1, paddingVertical: 12, gap: 8 });
  const body = view.getByText('Set app limits. Complete a reset, then request a 5- or 10-minute app break.');
  expect(StyleSheet.flatten(body.props.style).fontSize).toBe(17);
  expect(body.props.numberOfLines).toBeUndefined();
});

test('large accessible text keeps the root scrollable without truncation or limiting font scaling', () => {
  mockDimensions = { height: 667, width: 375, fontScale: 2 };
  const view = render(<WelcomeScreen onStart={jest.fn()} onSkip={jest.fn()} />);
  expect(view.getByTestId('welcome-content').props.scrollEnabled).not.toBe(false);
  for (const text of view.UNSAFE_getAllByType(Text)) {
    expect(text.props.allowFontScaling).not.toBe(false);
    expect(text.props.numberOfLines).toBeUndefined();
  }
});


test('live System device-language change updates all welcome copy after the preference-provider layout effect', async () => {
  // Match AppPreferencesProvider ordering: context changes render the screen
  // before the parent layout effect changes i18n. A direct appI18n.t read would
  // keep that render's old English text until an unrelated later render.
  function DeviceLanguageEffect({ children }: { children: React.ReactNode }) {
    const language = React.useContext(DeviceLanguageContext);
    React.useLayoutEffect(() => { void appI18n.changeLanguage(language); }, [language]);
    return <I18nextProvider i18n={appI18n}>{children}</I18nextProvider>;
  }
  const start = jest.fn(), personalize = jest.fn();
  const welcome = <WelcomeScreen onStart={start} onSkip={personalize} />;
  const provider = (language: string) => <DeviceLanguageContext.Provider value={language}><DeviceLanguageEffect>{welcome}</DeviceLanguageEffect></DeviceLanguageContext.Provider>;
  const languageChanged = jest.fn();
  appI18n.on('languageChanged', languageChanged);
  try {
    const view = render(provider('en'));
    expect(view.getByText('Set app limits. Complete a reset, then request a 5- or 10-minute app break.')).toBeOnTheScreen();
    await act(async () => { view.rerender(provider('de')); });
    expect(languageChanged).toHaveBeenCalledWith('de');
    const german = appI18n.getFixedT('de');
    for (const key of ['title', 'purpose', 'getStarted', 'existingAccount', 'requiredAccess']) {
      expect(view.getByText(german(`welcome.${key}`))).toBeOnTheScreen();
    }
    expect(view.queryByText('Set app limits. Complete a reset, then request a 5- or 10-minute app break.')).toBeNull();
    expect(view.queryByText('Get started')).toBeNull();
    fireEvent.press(view.getByTestId('onboarding-start'));
    expect(start).toHaveBeenCalledTimes(1);
    expect(personalize).not.toHaveBeenCalled();
  } finally {
    appI18n.off('languageChanged', languageChanged);
  }
});


test('welcome explains the example allowance, reset, explicit app time and protected adult websites before continuing', () => {
  const start = jest.fn(), account = jest.fn();
  const view = render(<WelcomeScreen onStart={start} onSkip={account} />);
  expect(view.getByTestId('welcome-earned-time-example')).toBeOnTheScreen();
  const flow = view.getByText('30 min daily → reset → 5 or 10 min');
  expect(flow).toHaveProp('accessibilityLabel', 'After 30 minutes, complete a reset to request 5 or 10 more minutes in that app.');
  expect(view.getByText('20 min extra each day. Edit limits in Protect.')).toBeOnTheScreen();
  expect(view.getByText('Adult websites stay blocked.')).toBeOnTheScreen();
  expect(start).not.toHaveBeenCalled();
  expect(account).not.toHaveBeenCalled();
  expect(view.queryAllByRole('adjustable')).toHaveLength(0);
});

test.each(['light', 'dark'] as const)('welcome example uses the existing %s surface and keeps the ordinary kite compact', mode => {
  mockMode = mode; mockDimensions = { height: 932, width: 430, fontScale: 1 };
  const view = render(<WelcomeScreen onStart={jest.fn()} onSkip={jest.fn()} />);
  expect(StyleSheet.flatten(view.getByTestId('welcome-earned-time-example').props.style)).toMatchObject({ backgroundColor: getAppPalette(mode).surface, borderRadius: 16, borderCurve: 'continuous' });
  expect(StyleSheet.flatten(view.getByTestId('welcome-illustration').props.style).height).toBeLessThanOrEqual(112);
});

test.each(['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'])('%s welcome example and spoken sequence use actual locale resources', async language => {
  await appI18n.changeLanguage(language);
  const t = appI18n.getFixedT(language);
  const view = render(<WelcomeScreen onStart={jest.fn()} onSkip={jest.fn()} />);
  const numbers = { dailyMinutes: 30, shortMinutes: 5, longMinutes: 10 };
  expect(view.getByText(t('welcome.exampleTitle'))).toBeOnTheScreen();
  expect(view.getByText(t('welcome.exampleFlow', numbers))).toHaveProp('accessibilityLabel', t('welcome.exampleFlowSpoken', numbers));
  expect(view.getByText(t('welcome.exampleCap', { extraMinutes: 20 }))).toBeOnTheScreen();
  expect(view.getByText(t('welcome.adultWebsitesStayBlocked'))).toBeOnTheScreen();
});
