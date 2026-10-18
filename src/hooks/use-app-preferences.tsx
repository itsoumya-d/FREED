import 'expo-sqlite/localStorage/install';
import React from 'react';
import { Appearance, AppState, I18nManager, Platform, useColorScheme } from 'react-native';
import { getLocales } from 'expo-localization';
import { I18nextProvider } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
import { setProtectionPresentationPreferences } from 'freed-protection';
import { createPreferencesStore, resolveAppLanguage, resolveThemeMode, type AppPreferences, type PreferencesSnapshot, DEFAULT_PREFERENCES } from '@/lib/app-preferences';

const preferenceStore = createPreferencesStore({
  getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value),
});
const serverSnapshot: PreferencesSnapshot = { preferences: DEFAULT_PREFERENCES, hydrated: false, error: null };
const PreferencesContext = React.createContext<ReturnType<typeof usePreferencesValue> | null>(null);
function readDeviceLanguage() { try { return getLocales()[0]?.languageTag ?? 'en'; } catch { return 'en'; } }
function usePreferencesValue() {
  const snapshot = React.useSyncExternalStore(preferenceStore.subscribe, preferenceStore.getSnapshot, () => serverSnapshot);
  const systemTheme = useColorScheme();
  const [deviceLanguage, setDeviceLanguage] = React.useState(readDeviceLanguage);
  const language = resolveAppLanguage(snapshot.preferences.language, deviceLanguage);
  const mode = resolveThemeMode(snapshot.preferences.themeMode, systemTheme);
  React.useLayoutEffect(() => { preferenceStore.hydrate(); }, []);
  React.useLayoutEffect(() => {
    if (snapshot.hydrated) setProtectionPresentationPreferences({ language, themeMode: snapshot.preferences.themeMode, languagePreference: snapshot.preferences.language });
    if (Platform.OS !== 'web' && typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(snapshot.preferences.themeMode === 'system' ? 'unspecified' : snapshot.preferences.themeMode);
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
      document.documentElement.style.colorScheme = mode;
    }
    void appI18n.changeLanguage(language);
    // Direction is read before native mount, and changes are applied through an explicit restart.
    I18nManager.allowRTL(language === 'ar');
    I18nManager.forceRTL(language === 'ar');
  }, [snapshot.hydrated, snapshot.preferences.themeMode, language, mode]);
  React.useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') setDeviceLanguage(readDeviceLanguage()); });
    return () => listener.remove();
  }, []);
  const update = React.useCallback((values: Partial<AppPreferences>) => preferenceStore.update(values), []);
  return { ...snapshot, language, mode, rtl: language === 'ar', update };
}
export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const value = usePreferencesValue();
  if (!value.hydrated) return null;
  return <PreferencesContext.Provider value={value}><I18nextProvider i18n={appI18n}>{children}</I18nextProvider></PreferencesContext.Provider>;
}
export function useOptionalAppPreferences() {
  return React.useContext(PreferencesContext);
}
export function useAppPreferences() {
  const context = useOptionalAppPreferences();
  if (!context) throw new Error('App preferences must be rendered inside AppPreferencesProvider.');
  return context;
}
