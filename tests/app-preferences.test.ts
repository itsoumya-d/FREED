import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreferencesStore, normalizePreferences, resolveAppLanguage, resolveThemeMode } from '../src/lib/app-preferences';

test('preferences default to system without changing recovery history', () => {
  assert.deepEqual(normalizePreferences(null), { themeMode: 'system', language: 'system', companionMotion: 'system' });
  assert.deepEqual(normalizePreferences({ themeMode: 'unknown', language: 'xx' }), { themeMode: 'system', language: 'system', companionMotion: 'system' });
  assert.equal(resolveThemeMode('system', null), 'light');
  assert.equal(resolveThemeMode('light', 'dark'), 'light');
  assert.equal(resolveThemeMode('system', 'dark'), 'dark');
});
test('device language resolves supported language tags and explicit choices', () => {
  for (const [locale, expected] of [['hi-IN','hi'], ['bn-BD','en'], ['ar-SA','ar'], ['zh-CN','zh-Hans'], ['zh-Hans-SG','zh-Hans'], ['pt-BR','pt'], ['ko-KR','ko']]) {
    assert.equal(resolveAppLanguage('system', locale), expected);
  }
  assert.equal(resolveAppLanguage('fr', 'ar-SA'), 'fr');
  assert.equal(resolveAppLanguage('system', 'zh-TW'), 'en');
});
test('preferences survive restart and subscribers observe committed values only', () => {
  let saved: string | null = null;
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  const store = createPreferencesStore(storage);
  store.hydrate();
  const events: string[] = [];
  const unsubscribe = store.subscribe(() => events.push(store.getSnapshot().preferences.themeMode));
  store.update({ themeMode: 'dark', language: 'ar', companionMotion: 'system' });
  assert.deepEqual(events, ['dark']);
  const restarted = createPreferencesStore(storage); restarted.hydrate();
  assert.deepEqual(restarted.getSnapshot().preferences, { themeMode: 'dark', language: 'ar', companionMotion: 'system' });
  unsubscribe();
  store.update({ themeMode: 'light' });
  assert.deepEqual(events, ['dark']);
});
test('storage failures preserve the last committed preference and surface a recoverable error', () => {
  const store = createPreferencesStore({ getItem: () => '{broken', setItem: () => { throw new Error('disk full'); } });
  store.hydrate();
  assert.equal(store.getSnapshot().hydrated, true);
  assert.equal(store.getSnapshot().error, 'load');
  assert.throws(() => store.update({ language: 'ja' }), /saved/);
  assert.equal(store.getSnapshot().preferences.language, 'system');
  assert.equal(store.getSnapshot().error, 'save');
});

test('legacy Bengali preference migrates to System without changing theme or other saved data', () => {
  const saved = JSON.stringify({ language: 'bn', themeMode: 'dark' });
  const store = createPreferencesStore({ getItem: () => saved, setItem: () => undefined });
  store.hydrate();
  assert.deepEqual(store.getSnapshot().preferences, { language: 'system', themeMode: 'dark', companionMotion: 'system' });
  assert.equal(resolveAppLanguage(store.getSnapshot().preferences.language, 'ko-KR'), 'ko');
});

test('legacy records gain system companion motion and malformed motion stays safe', () => {
  assert.deepEqual(normalizePreferences({ themeMode: 'dark', language: 'ko' }), { themeMode: 'dark', language: 'ko', companionMotion: 'system' });
  assert.equal(normalizePreferences({ companionMotion: 'off' }).companionMotion, 'off');
  for (const companionMotion of ['on', '', null, false, 3]) assert.equal(normalizePreferences({ companionMotion }).companionMotion, 'system');
});
test('companion motion survives restart and failed changes retain committed state until retry', () => {
  let saved = JSON.stringify({ themeMode: 'dark', language: 'fr', companionMotion: 'system' });
  let fail = false;
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { if (fail) throw new Error('disk full'); saved = value; } };
  const store = createPreferencesStore(storage); store.hydrate();
  store.update({ companionMotion: 'off' });
  const restarted = createPreferencesStore(storage); restarted.hydrate();
  assert.deepEqual(restarted.getSnapshot().preferences, { themeMode: 'dark', language: 'fr', companionMotion: 'off' });
  fail = true;
  assert.throws(() => store.update({ companionMotion: 'system' }), /saved/);
  assert.equal(store.getSnapshot().preferences.companionMotion, 'off');
  assert.equal(JSON.parse(saved).companionMotion, 'off');
  assert.equal(store.getSnapshot().error, 'save');
  fail = false; store.update({ companionMotion: 'system' });
  assert.equal(store.getSnapshot().error, null);
  assert.equal(JSON.parse(saved).companionMotion, 'system');
});
