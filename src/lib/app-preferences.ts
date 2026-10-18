export const SUPPORTED_LANGUAGES = ['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export type AppLanguage = 'system' | SupportedLanguage;
export type ThemeMode = 'system' | 'light' | 'dark';
export type CompanionMotionPreference = 'system' | 'off';
export type AppPreferences = { themeMode: ThemeMode; language: AppLanguage; companionMotion: CompanionMotionPreference };
export const PREFERENCES_STORAGE_KEY = 'freed.preferences.v1';
export const DEFAULT_PREFERENCES: AppPreferences = { themeMode: 'system', language: 'system', companionMotion: 'system' };
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English', hi: 'हिन्दी', ko: '한국어', es: 'Español', pt: 'Português', fr: 'Français',
  de: 'Deutsch', ar: 'العربية', ja: '日本語', 'zh-Hans': '简体中文',
};
export function normalizePreferences(value: unknown): AppPreferences {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    companionMotion: raw.companionMotion === 'off' ? 'off' : 'system',
    themeMode: ['system','light','dark'].includes(String(raw.themeMode)) ? raw.themeMode as ThemeMode : 'system',
    language: raw.language === 'system' || SUPPORTED_LANGUAGES.includes(raw.language as SupportedLanguage) ? raw.language as AppLanguage : 'system',
  };
}
export function resolveThemeMode(preference: ThemeMode, device: 'light' | 'dark' | 'unspecified' | null | undefined): 'light' | 'dark' {
  return preference === 'system' ? device === 'dark' ? 'dark' : 'light' : preference;
}
export function resolveAppLanguage(preference: AppLanguage, deviceLocale?: string | null): SupportedLanguage {
  if (preference !== 'system') return preference;
  const tag = (deviceLocale ?? 'en').replace(/_/g, '-').toLowerCase();
  if (/^zh(?:-|$)/.test(tag)) return /(?:hant|tw|hk|mo)/.test(tag) ? 'en' : 'zh-Hans';
  const language = tag.split('-')[0];
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage) ? language as SupportedLanguage : 'en';
}
type PreferenceStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export type PreferencesSnapshot = { preferences: AppPreferences; hydrated: boolean; error: 'load' | 'save' | null };
export function createPreferencesStore(storage: PreferenceStorage) {
  let snapshot: PreferencesSnapshot = { preferences: { ...DEFAULT_PREFERENCES }, hydrated: false, error: null };
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) listener(); };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    hydrate() {
      if (snapshot.hydrated) return;
      try {
        const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
        snapshot = { preferences: normalizePreferences(raw ? JSON.parse(raw) : null), hydrated: true, error: null };
      } catch { snapshot = { preferences: { ...DEFAULT_PREFERENCES }, hydrated: true, error: 'load' }; }
      emit();
    },
    update(update: Partial<AppPreferences>) {
      const next = normalizePreferences({ ...snapshot.preferences, ...update });
      try { storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next)); }
      catch {
        snapshot = { ...snapshot, error: 'save' }; emit();
        throw new Error('Your preferences could not be saved. Try again.');
      }
      snapshot = { preferences: next, hydrated: true, error: null }; emit();
    },
  };
}
