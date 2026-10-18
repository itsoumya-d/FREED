const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const renderIntentFilters = require('@expo/config-plugins/build/android/IntentFilters').default;
const { setAssociatedDomains } = require('@expo/config-plugins/build/ios/Entitlements');

const {
  RECOVERY_APP_LINK,
  RECOVERY_ASSOCIATED_DOMAIN,
  RECOVERY_INTENT_FILTER,
  applyRecoveryAppLinkConfig
} = require('../scripts/lib/recovery-app-link-config');

test('the recovery app-link helper merges existing native config and is idempotent', () => {
  const authFilter = {
    action: 'VIEW',
    autoVerify: true,
    data: [{ scheme: 'https', host: 'freed-7d5ee.firebaseapp.com', pathPrefix: '/__/auth/links' }],
    category: ['BROWSABLE', 'DEFAULT']
  };
  const input = {
    name: 'Fixture',
    ios: { associatedDomains: ['applinks:accounts.example'], supportsTablet: true },
    android: { intentFilters: [authFilter], package: 'app.freed.recovery' }
  };
  const unchanged = structuredClone(input);
  const once = applyRecoveryAppLinkConfig(input);
  const twice = applyRecoveryAppLinkConfig(once);

  assert.deepEqual(input, unchanged, 'the helper must not mutate its input');
  assert.deepEqual(once.ios.associatedDomains, ['applinks:accounts.example', RECOVERY_ASSOCIATED_DOMAIN]);
  assert.equal(once.ios.supportsTablet, true);
  assert.equal(once.android.package, 'app.freed.recovery');
  assert.deepEqual(once.android.intentFilters[0], authFilter);
  assert.deepEqual(once.android.intentFilters[1], RECOVERY_INTENT_FILTER);
  assert.deepEqual(twice, once);
  assert.equal(RECOVERY_APP_LINK, 'https://freed-7d5ee.firebaseapp.com/intervention');
  assert.equal(RECOVERY_INTENT_FILTER.data[0].host, 'freed-7d5ee.firebaseapp.com');
  assert.equal(RECOVERY_INTENT_FILTER.data[0].path, '/intervention');
  assert.equal(JSON.stringify(RECOVERY_INTENT_FILTER).includes('*'), false);
});

test('Expo SDK transformations receive the exact merged iOS domain and Android filter', () => {
  const configured = applyRecoveryAppLinkConfig({
    ios: { associatedDomains: ['applinks:existing.example'] },
    android: { intentFilters: [] }
  });
  const entitlements = setAssociatedDomains(configured, {
    'com.apple.developer.associated-domains': ['applinks:stale.example'],
    'com.apple.developer.family-controls': true
  });
  assert.deepEqual(entitlements['com.apple.developer.associated-domains'], [
    'applinks:existing.example',
    'applinks:freed-7d5ee.firebaseapp.com'
  ]);
  assert.equal(entitlements['com.apple.developer.family-controls'], true);

  const rendered = renderIntentFilters(configured.android.intentFilters)[0];
  assert.equal(rendered.$['android:autoVerify'], 'true');
  assert.deepEqual(rendered.action, [{ $: { 'android:name': 'android.intent.action.VIEW' } }]);
  assert.deepEqual(rendered.category, [
    { $: { 'android:name': 'android.intent.category.DEFAULT' } },
    { $: { 'android:name': 'android.intent.category.BROWSABLE' } }
  ]);
  assert.deepEqual(rendered.data, [{ $: {
    'android:scheme': 'https',
    'android:host': 'freed-7d5ee.firebaseapp.com',
    'android:path': '/intervention'
  } }]);
});

test('the actual app config preserves caller-supplied domains and filters while adding recovery', () => {
  const appConfig = require('../app.config');
  const base = require('../app.json').expo;
  const oldFilter = { action: 'VIEW', data: [{ scheme: 'freed' }], category: ['DEFAULT', 'BROWSABLE'] };
  const config = appConfig({ config: {
    ...base,
    ios: { ...base.ios, associatedDomains: ['applinks:existing.example'] },
    android: { ...base.android, intentFilters: [oldFilter] }
  } });

  assert.deepEqual(config.ios.associatedDomains, [
    'applinks:existing.example',
    'applinks:freed-7d5ee.firebaseapp.com'
  ]);
  assert.deepEqual(config.android.intentFilters[0], oldFilter);
  assert.deepEqual(config.android.intentFilters[1], RECOVERY_INTENT_FILTER);
});

test('the checked-in MainActivity keeps custom schemes and auth while adding a separate exact recovery filter', () => {
  const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  const filters = [...manifest.matchAll(/<intent-filter(?:\s[^>]*)?>[\s\S]*?<\/intent-filter>/g)].map(match => match[0]);
  const recovery = filters.filter(filter => filter.includes('android:host="freed-7d5ee.firebaseapp.com"') && filter.includes('android:path="/intervention"'));
  assert.equal(recovery.length, 1);
  assert.match(recovery[0], /android:autoVerify="true"/);
  assert.match(recovery[0], /android:scheme="https"/);
  assert.doesNotMatch(recovery[0], /pathPrefix|android:host="\*|android:scheme="freed"/);
  assert.ok(filters.some(filter => filter.includes('android:scheme="freed"') && filter.includes('android:scheme="app.freed.recovery"')));
  assert.ok(filters.some(filter => filter.includes('android:pathPrefix="\/__\/auth\/links"')));
});
