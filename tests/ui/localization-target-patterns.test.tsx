import { appI18n, localeResources, translateSource } from '@/i18n/runtime';
import { SUPPORTED_LANGUAGES } from '@/lib/app-preferences';
import { MOMENTUM_RESET_TEMPLATES } from '@/data/momentum-resets';

const targets = ['flower', 'plant', 'chair', 'cup', 'shoe', 'branch', 'clock', 'fruit'] as const;
afterEach(async () => { await appI18n.changeLanguage('en'); });

test.each(SUPPORTED_LANGUAGES)('%s localizes known photo-target nouns without changing their rule identifiers', async language => {
  await appI18n.changeLanguage(language);
  const source = localeResources[language].source as Record<string, string>;
  const rulesBefore = JSON.stringify(MOMENTUM_RESET_TEMPLATES.map(item => item.verification));
  for (const id of targets) {
    expect(source[id]?.trim()).toBeTruthy();
    if (language !== 'en') expect(source[id]).not.toBe(id);
    for (const text of [`Find a ${id}`, `Find a ${id} nearby.`]) {
      const result = translateSource(text, language);
      expect(result).toBe(source[text]);
      if (language !== 'en') expect(result).not.toBe(text);
      expect(result).not.toMatch(/\{\{|\}\}/);
      expect(result).toContain(source[id]);
    }
  }
  expect(JSON.stringify(MOMENTUM_RESET_TEMPLATES.map(item => item.verification))).toBe(rulesBefore);
});

test.each(SUPPORTED_LANGUAGES)('%s preserves private data inside authored status patterns', language => {
  const domain = 'private-example.invalid';
  const result = translateSource(`Remove ${domain} from local exceptions`, language);
  expect(result).toContain(domain);
  expect(result).not.toContain('{{domain}}');
  for (const privateText of ['My private reflection 984', 'https://example.invalid/Find%20a%20flower', 'uid-private-932']) {
    expect(translateSource(privateText, language)).toBe(privateText);
  }
});

test('Arabic numeric action patterns preserve count meaning and localize visible digits', async () => {
  await appI18n.changeLanguage('ar');
  expect(translateSource('Request 10 min app break', 'ar')).toContain('١٠');
  expect(translateSource('About 60 seconds', 'ar')).toContain('٦٠');
  expect(translateSource('Strict guard: saved on · off or not acknowledged', 'ar')).not.toMatch(/saved on|off or not acknowledged/);
});

test.each(SUPPORTED_LANGUAGES)('%s interpolates cloud reply allowance as localized numbers without changing quota values', async language => {
  await appI18n.changeLanguage(language);
  const values = { remaining: 2, limit: 20 };
  const result = appI18n.t('purpose.claraCloudQuota', values);
  expect(result).not.toContain('purpose.claraCloudQuota');
  expect(result).not.toMatch(/\{\{|\}\}/);
  const formatter = new Intl.NumberFormat(language, language === 'ar' ? { numberingSystem: 'arab' } : {});
  expect(result).toContain(formatter.format(values.remaining));
  expect(result).toContain(formatter.format(values.limit));
  expect(values).toEqual({ remaining: 2, limit: 20 });
});
