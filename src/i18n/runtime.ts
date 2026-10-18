import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import ko from './locales/ko.json';
import es from './locales/es.json';
import pt from './locales/pt.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ar from './locales/ar.json';
import ja from './locales/ja.json';
import zh from './locales/zh-Hans.json';
import type { SupportedLanguage } from '@/lib/app-preferences';
import { formatNumber } from './number-format';
import { translateAuthoredSource } from './source-translation';

export const localeResources = { en, hi, es, pt, fr, de, ar, ja, ko, 'zh-Hans': zh };
export const appI18n = i18next.createInstance();
void appI18n.use(initReactI18next).use({
  type: 'formatter',
  init: () => undefined,
  format: (value: unknown, _format: string | undefined, language: string | undefined, options?: Record<string, unknown>): string => {
    // Typed counts remain numeric for plural selection; only display is formatted.
    const opaque = /price|productId|url|uri|email|host|domain|token|name|phone|reflection|note|prompt|input|^id$/i.test(String(options?.interpolationkey ?? ''));
    return typeof value === 'number' && !opaque ? formatNumber(value, language ?? 'en') : String(value ?? '');
  },
}).init({
  resources: Object.fromEntries(Object.entries(localeResources).map(([language, translation]) => [language, { translation }])),
  lng: 'en', fallbackLng: 'en', supportedLngs: Object.keys(localeResources),
  load: 'currentOnly', initAsync: false, interpolation: { escapeValue: false, alwaysFormat: true },
  react: { useSuspense: false },
});
/** Bridge for existing authored strings; identifiers, URLs and input values never pass through it. */
export function translateSource(value: string, language = appI18n.language as SupportedLanguage): string {
  const source = localeResources[language]?.source as Record<string, string> | undefined;
  if (!source || language === 'en') return value;
  return translateAuthoredSource(value, source, 0, language);
}
export function localizedNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return formatNumber(value, appI18n.language, options);
}
export function localizedDate(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(appI18n.language, options).format(typeof value === 'string' ? new Date(value) : value);
}

/** Localize only the legacy numeric elapsed format, never arbitrary/private text. */
export function localizedElapsed(value: string, language = appI18n.language as SupportedLanguage): string {
  if (!/^\d+[dhms](?:\s+\d+[dhms])*$/.test(value)) return value;
  const units: Record<string, string> = { d: 'Days', h: 'Hours', m: 'Minutes', s: 'Seconds' };
  // Hermes/ICU unit formatting can convert hours/minutes into seconds. Counts
  // remain in their recorded unit; only numeric display and noun plurals change.
  return value.split(/\s+/).map(part => appI18n.t(`momentum.duration${units[part.slice(-1)]}`, {
    count: Number(part.slice(0, -1)), lng: language,
  })).join(' ');
}
