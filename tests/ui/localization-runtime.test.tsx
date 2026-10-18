import { appI18n, localeResources, localizedDate, localizedNumber, localizedElapsed, translateSource } from '@/i18n/runtime';
import { SUPPORTED_LANGUAGES } from '@/lib/app-preferences';

function leaves(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' ? Object.entries(leaves(child as Record<string, unknown>, name)) : [[name, child]];
  })) as Record<string, string>;
}
const placeholders = (value: string) => [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map(match => match[1].trim()).sort();
afterEach(async () => { await appI18n.changeLanguage('en'); });

test.each(SUPPORTED_LANGUAGES)('%s has the full non-empty resource topology and preserves interpolation arguments', language => {
  const reference = leaves(localeResources.en);
  const actual = leaves(localeResources[language]);
  expect(Object.keys(actual).sort()).toEqual(Object.keys(reference).sort());
  expect(Object.keys(localeResources[language]).sort()).toEqual(['appEditor', 'common', 'companion', 'dns', 'earnedProof', 'earnedSetup', 'earnedTime', 'guidedWebsiteSetup', 'intercept', 'iosWebsiteSetup', 'momentum', 'native', 'preferences', 'premiumOfferCompact', 'progressCompact', 'progressDaily', 'progressPurpose', 'protectionAuthorization', 'publicHelp', 'purpose', 'resetChoices', 'resetRecoveryUi', 'resetReward', 'safariConfiguration', 'source', 'welcome']);
  for (const [key, value] of Object.entries(actual)) {
    expect(typeof value).toBe('string');
    expect(value.trim().length).toBeGreaterThan(0);
    expect(placeholders(value)).toEqual(placeholders(reference[key]));
  }
});

test.each(SUPPORTED_LANGUAGES)('%s runtime translates authored copy and preserves unknown URLs and input', async language => {
  await appI18n.changeLanguage(language);
  expect(appI18n.t('preferences.appearance')).toBe(localeResources[language].preferences.appearance);
  expect(translateSource('Preferences', language)).toBe(localeResources[language].source.Preferences);
  for (const untouched of ['https://freed.example/path?q=Preferences', 'uid-test-123', 'My private reflection 984', 'unknown authored string']) expect(translateSource(untouched, language)).toBe(untouched);
});

test('source bridge normalizes authored whitespace without changing unmapped input', () => {
  expect(translateSource('  Preferences\n ', 'fr')).toBe(localeResources.fr.source.Preferences);
  expect(translateSource('   private input   ', 'fr')).toBe('   private input   ');
});

test.each(['ar', 'de', 'hi', 'ja'] as const)('%s dates and numbers use the active runtime locale', async language => {
  await appI18n.changeLanguage(language);
  expect(localizedNumber(12345.5, { maximumFractionDigits: 1 })).toBe(new Intl.NumberFormat(language, { maximumFractionDigits: 1, ...(language === 'ar' ? { numberingSystem: 'arab' } : {}) }).format(12345.5));
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' };
  expect(localizedDate('2026-10-02T12:00:00Z', options)).toBe(new Intl.DateTimeFormat(language, options).format(new Date('2026-10-02T12:00:00Z')));
});

test('Arabic semantic plural counts and legacy elapsed durations use localized numeric units', async () => {
  await appI18n.changeLanguage('ar');
  for (const count of [0, 1, 2, 3, 11, 100]) {
    const text = appI18n.t('momentum.recordedDays', { count });
    expect(text).toContain(new Intl.NumberFormat('ar', { numberingSystem: 'arab' }).format(count));
    expect(text).not.toContain('momentum.');
  }
  expect(localizedElapsed('12d 0h 00m')).toBe('١٢ يومًا ٠ ساعة ٠ دقيقة');
  expect(localizedElapsed('Calm2 private reflection')).toBe('Calm2 private reflection');
});

test('elapsed display resists native Intl unit conversion and milestones select singular copy', async () => {
  await appI18n.changeLanguage('en');
  const NativeNumberFormat = Intl.NumberFormat;
  const formatter = jest.spyOn(Intl, 'NumberFormat').mockImplementation(((language, options) => options?.style === 'unit' ? { format: () => '18,000 seconds' } : new NativeNumberFormat(language, options)) as typeof Intl.NumberFormat);
  try { expect(localizedElapsed('5h 57m')).toBe('5 hours 57 minutes'); }
  finally { formatter.mockRestore(); }
  expect(appI18n.t('momentum.nextMilestone', { count: 1 })).toBe('Next milestone · 1 day');
});
