import React from 'react';
import { I18nManager, Platform, StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { reloadAppAsync } from 'expo';
import { I18nextProvider } from 'react-i18next';
import { PreferencesScreen } from '@/components/PreferencesScreen';
import { appI18n } from '@/i18n/runtime';
import { getAppPalette } from '@/design-system/app-palette';
import { loadRecoveryDraft, saveRecoveryDraft } from '@/lib/recovery-drafts';
import { createPreferencesStore, PREFERENCES_STORAGE_KEY, LANGUAGE_NAMES, SUPPORTED_LANGUAGES, resolveAppLanguage, resolveThemeMode, type AppPreferences } from '@/lib/app-preferences';

jest.mock('@/components/DirectionalIcons', () => ({ ChevronRight: () => null }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ spatialMotion: false, reduceMotion: true, active: true, focused: true, foreground: true }), SPRINGS: { pop: {}, snap: {} } }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-image', () => ({ Image: require('react-native').Image }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/components/PreferencePicker', () => ({ PreferencePicker: (props: any) => {
  const React = require('react');
  const { Platform } = require('react-native');
  const native = Platform.OS === 'ios' ? jest.requireActual('@/components/PreferencePicker.ios') : jest.requireActual('@/components/PreferencePicker.android');
  return React.createElement(native.PreferencePicker, props);
} }));

let mockSaved: string | null;
let mockStorageFails: boolean;
let mockStore: ReturnType<typeof createPreferencesStore>;
let mockDeviceLanguage = 'en-US';
jest.mock('@/hooks/use-app-preferences', () => {
  const React = require('react');
  const { resolveAppLanguage, resolveThemeMode } = require('@/lib/app-preferences');
  return { useAppPreferences: () => {
    const snapshot = React.useSyncExternalStore(mockStore.subscribe, mockStore.getSnapshot, mockStore.getSnapshot);
    return { ...snapshot, language: resolveAppLanguage(snapshot.preferences.language, mockDeviceLanguage), mode: resolveThemeMode(snapshot.preferences.themeMode, 'light'), rtl: snapshot.preferences.language === 'ar', update: mockStore.update };
  } };
});

function newStore(preferences?: Partial<AppPreferences>) {
  mockSaved = preferences ? JSON.stringify({ themeMode: 'system', language: 'system', ...preferences }) : null;
  mockStorageFails = false;
  mockStore = createPreferencesStore({ getItem: () => mockSaved, setItem: (_key, value) => { if (mockStorageFails) throw new Error('full disk'); mockSaved = value; } });
  mockStore.hydrate();
}
async function renderPreferences(nativeHeader = false) { return render(<I18nextProvider i18n={appI18n}><PreferencesScreen {...({ nativeHeader } as any)} /></I18nextProvider>); }
beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: false });
  mockDeviceLanguage = 'en-US';
  newStore();
  await appI18n.changeLanguage('en');
  (reloadAppAsync as jest.Mock).mockResolvedValue(undefined);
});

test('appearance and all ten language choices expose accessible selection state', async () => {
  const screen = await renderPreferences();
  for (const label of ['System', 'Light', 'Dark']) expect(screen.getAllByRole('radio', { name: label }).length).toBeGreaterThan(0);
  expect(screen.queryByTestId('language-system')).toBeNull();
  fireEvent.press(screen.getByTestId('language-open'));
  for (const language of SUPPORTED_LANGUAGES) expect(screen.getByRole('radio', { name: LANGUAGE_NAMES[language] })).not.toBeChecked();
  expect(screen.getByTestId('appearance-system')).toBeChecked();
  expect(screen.getByTestId('language-system')).toBeChecked();
  expect(screen.queryByTestId('language-restart-notice')).toBeNull();
});

test.each(['light', 'dark', 'system'] as const)('%s appearance commits, updates the palette and survives a new store', async themeMode => {
  newStore({ themeMode: themeMode === 'dark' ? 'light' : 'dark' });
  const screen = await renderPreferences();
  await fireEvent.press(screen.getByTestId(`appearance-${themeMode}`));
  expect(screen.getByTestId(`appearance-${themeMode}`)).toBeChecked();
  expect(StyleSheet.flatten(screen.getByTestId('screen-preferences').props.style).backgroundColor).toBe(getAppPalette(resolveThemeMode(themeMode, 'light')).bg);
  const restarted = createPreferencesStore({ getItem: () => mockSaved, setItem: () => undefined });
  restarted.hydrate();
  expect(restarted.getSnapshot().preferences.themeMode).toBe(themeMode);
  expect(restarted.getSnapshot().preferences.language).toBe('system');
});

test('failed saving keeps committed selection and exposes an alert that clears after retry', async () => {
  const screen = await renderPreferences();
  mockStorageFails = true;
  await fireEvent.press(screen.getByTestId('appearance-dark'));
  expect(screen.getByTestId('appearance-system')).toBeChecked();
  expect(screen.getByTestId('appearance-dark')).not.toBeChecked();
  expect(screen.getByTestId('preferences-error')).toHaveTextContent(appI18n.t('preferences.saveError'));
  expect(screen.getByTestId('preferences-error')).toHaveProp('accessibilityRole', 'alert');
  mockStorageFails = false;
  await fireEvent.press(screen.getByTestId('preferences-retry'));
  expect(screen.queryByTestId('preferences-error')).toBeNull();
  expect(JSON.parse(mockSaved!).themeMode).toBe('dark');
});

test('iOS segmented appearance integrates with the real store, rolls back a failed write and retries without touching drafts', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (mockStorageFails) throw new Error('full disk'); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const authored = { trigger: 'Tired', note: '  ჩემი ჩანაწერი\n私の言葉  ' };
  saveRecoveryDraft(storage, 'slip', authored);
  mockStore = createPreferencesStore(storage);
  mockStore.hydrate();
  const screen = await renderPreferences();
  const picker = () => screen.getByTestId('mock-native-preference-picker');
  expect(picker().props.selection).toBe('system');
  fireEvent(picker(), 'selectionChange', 'dark');
  expect(picker().props.selection).toBe('dark');
  expect(StyleSheet.flatten(screen.getByTestId('screen-preferences').props.style).backgroundColor).toBe(getAppPalette('dark').bg);
  mockStorageFails = true;
  fireEvent(picker(), 'selectionChange', 'light');
  expect(picker().props.selection).toBe('dark');
  expect(screen.getByTestId('preferences-error')).toBeOnTheScreen();
  mockStorageFails = false;
  fireEvent.press(screen.getByTestId('preferences-retry'));
  expect(picker().props.selection).toBe('light');
  expect(screen.queryByTestId('preferences-error')).toBeNull();
  const restarted = createPreferencesStore(storage);
  restarted.hydrate();
  expect(restarted.getSnapshot().preferences.themeMode).toBe('light');
  expect(loadRecoveryDraft(storage, 'slip')).toEqual(authored);
});

test('Arabic saves before explicit restart, and failed restart retains a recoverable notice', async () => {
  const screen = await renderPreferences();
  fireEvent.press(screen.getByTestId('language-open'));
  await fireEvent.press(screen.getByTestId('language-ar'));
  expect(JSON.parse(mockSaved!).language).toBe('ar');
  expect(screen.queryByTestId('language-ar')).toBeNull();
  expect(screen.getByTestId('language-open')).toHaveProp('accessibilityValue', { text: 'العربية' });
  expect(screen.getByTestId('language-restart-notice')).toBeOnTheScreen();
  expect(reloadAppAsync).not.toHaveBeenCalled();
  (reloadAppAsync as jest.Mock).mockRejectedValueOnce(new Error('restart unavailable'));
  await act(async () => { fireEvent.press(screen.getByTestId('language-restart')); });
  expect(reloadAppAsync).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('preferences-error')).toHaveTextContent(appI18n.t('preferences.restartRequired'));
  expect(JSON.parse(mockSaved!).language).toBe('ar');
  await act(async () => { fireEvent.press(screen.getByTestId('language-restart')); });
  expect(reloadAppAsync).toHaveBeenCalledTimes(2);
});

test.each(['en', 'system'] as const)('Arabic native layout offers restart after switching to LTR %s', async language => {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value: true });
  newStore({ language: 'ar' });
  const screen = await renderPreferences();
  fireEvent.press(screen.getByTestId('language-open'));
  await fireEvent.press(screen.getByTestId(`language-${language}`));
  expect(JSON.parse(mockSaved!).language).toBe(language);
  expect(screen.getByTestId('language-restart-notice')).toBeOnTheScreen();
});

test('failed Arabic write offers no restart and retains the last saved language', async () => {
  const screen = await renderPreferences();
  mockStorageFails = true;
  fireEvent.press(screen.getByTestId('language-open'));
  await fireEvent.press(screen.getByTestId('language-ar'));
  expect(mockStore.getSnapshot().preferences.language).toBe('system');
  expect(screen.queryByTestId('language-restart-notice')).toBeNull();
  expect(screen.getByTestId('preferences-error')).toBeOnTheScreen();
  expect(reloadAppAsync).not.toHaveBeenCalled();
});

test('Korean is selectable by its native name with a bundled flag and Bengali is retired', async () => {
  const screen = await renderPreferences();
  fireEvent.press(screen.getByTestId('language-open'));
  expect(screen.getByRole('radio', { name: '한국어' })).toBeTruthy();
  expect(screen.getByTestId('language-flag-ko', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('language-bn')).toBeNull();
  await fireEvent.press(screen.getByTestId('language-ko'));
  expect(JSON.parse(mockSaved!).language).toBe('ko');
});

test('preferences retain native controls below a contextual interactive Momentum header', async () => {
  const screen = await renderPreferences();
  expect(screen.getByRole('header', { name: 'Preferences' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /FREED companion/ })).toBeTruthy();
  expect(screen.getByTestId('appearance-system')).toBeChecked();
  expect(screen.queryByTestId('language-system')).toBeNull();
  fireEvent.press(screen.getByTestId('language-open'));
  expect(screen.getByTestId('language-system')).toBeChecked();
});

test('contextual animation switch persists and keeps committed value after a failed save', async () => {
  const screen = await renderPreferences();
  const toggle = () => screen.getByRole('switch', { name: 'Contextual animation' });
  expect(toggle()).toBeChecked();
  fireEvent(toggle(), 'valueChange', false);
  expect(toggle()).not.toBeChecked();
  expect(JSON.parse(mockSaved!).companionMotion).toBe('off');
  mockStorageFails = true;
  fireEvent(toggle(), 'valueChange', true);
  expect(toggle()).not.toBeChecked();
  expect(screen.getByTestId('preferences-error')).toBeOnTheScreen();
  mockStorageFails = false;
  fireEvent(toggle(), 'valueChange', true);
  expect(toggle()).toBeChecked();
  expect(screen.queryByTestId('preferences-error')).toBeNull();
});


test('language sheet dismisses without writing and failed selection stays open for an explicit retry', async () => {
  const screen = await renderPreferences();
  fireEvent.press(screen.getByTestId('language-open'));
  fireEvent.press(screen.getByTestId('language-close'));
  expect(screen.queryByTestId('language-ar')).toBeNull();
  expect(mockSaved).toBeNull();
  fireEvent.press(screen.getByTestId('language-open'));
  mockStorageFails = true;
  fireEvent.press(screen.getByTestId('language-ko'));
  expect(screen.getByTestId('language-system')).toBeChecked();
  expect(screen.getByTestId('preferences-error')).toBeOnTheScreen();
  mockStorageFails = false;
  fireEvent.press(screen.getByTestId('preferences-retry'));
  expect(screen.queryByTestId('language-ko')).toBeNull();
  expect(JSON.parse(mockSaved!).language).toBe('ko');
});


test('Arabic choice and explicit restart retain exact recovery drafts', async () => {
  const drafts = new Map<string, string>();
  const storage = { getItem: (key: string) => drafts.get(key) ?? null, setItem: (key: string, value: string) => { drafts.set(key, value); }, removeItem: (key: string) => { drafts.delete(key); } };
  const authored = { trigger: 'Tired', note: '  ჩემი ჩანაწერი\n私の言葉  ' };
  saveRecoveryDraft(storage, 'slip', authored);
  const before = [...drafts.entries()];
  mockStore = createPreferencesStore(storage);
  mockStore.hydrate();
  const screen = await renderPreferences();
  fireEvent.press(screen.getByTestId('language-open'));
  fireEvent.press(screen.getByTestId('language-ar'));
  await act(async () => { fireEvent.press(screen.getByTestId('language-restart')); });
  expect(reloadAppAsync).toHaveBeenCalledTimes(1);
  expect([...drafts.entries()].filter(([key]) => key !== PREFERENCES_STORAGE_KEY)).toEqual(before);
  expect(JSON.parse(storage.getItem(PREFERENCES_STORAGE_KEY)!).language).toBe('ar');
  expect(loadRecoveryDraft(storage, 'slip')).toEqual(authored);
});


test('native Preferences relies on its navigator title and keeps contextual help by Appearance', async () => {
  const screen = await renderPreferences(true);
  expect(screen.queryByRole('header', { name: 'Preferences' })).toBeNull();
  expect(screen.getByRole('header', { name: 'Appearance' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /FREED companion/ })).toBeOnTheScreen();
  expect(screen.getByTestId('appearance-system')).toBeChecked();
  fireEvent.press(screen.getByTestId('language-open'));
  expect(screen.getByTestId('language-system')).toBeChecked();
});

test.each(['light', 'dark'] as const)('%s does not claim to follow the device appearance', async themeMode => {
  newStore({ themeMode });
  const screen = await renderPreferences(true);
  expect(screen.queryByText(appI18n.t('preferences.followDevice'))).toBeNull();
  expect(screen.getByTestId(`appearance-${themeMode}`)).toBeChecked();
  fireEvent.press(screen.getByTestId('appearance-system'));
  expect(screen.getByText(appI18n.t('preferences.followDevice'))).toBeOnTheScreen();
});
