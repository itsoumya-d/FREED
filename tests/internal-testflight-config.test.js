const assert = require('node:assert/strict');
const test = require('node:test');
const appConfig = require('../app.config');
const base = require('../app.json').expo;
const profiles = require('../eas.json').build;
const keys = ['EAS_BUILD_PROFILE', 'EAS_BUILD_PLATFORM', 'EXPO_PUBLIC_BUILD_CHANNEL', 'EXPO_PUBLIC_MONETIZATION_MODE', 'EXPO_PUBLIC_ADMOB_USE_TEST_ADS', 'FREED_ENCRYPTED_DNS_RELEASE_ENABLED', 'EXPO_PUBLIC_FIREBASE_ENV', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME'];
function withEnvironment(env, action) {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => delete process.env[key]);
  Object.assign(process.env, env);
  try { return action(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
function internalEnv() { return { ...profiles.production.env, ...profiles.testflight.env, EAS_BUILD_PROFILE: 'testflight', EAS_BUILD_PLATFORM: 'ios' }; }
test('native TestFlight refuses absent or mismatched Google public inputs', () => {
  const valid = internalEnv();
  for (const key of keys.filter(key => key.startsWith('EXPO_PUBLIC_GOOGLE_'))) {
    const absent = { ...valid }; delete absent[key];
    withEnvironment(absent, () => assert.throws(() => appConfig({ config: base }), /Google.*required/i));
    withEnvironment({ ...valid, [key]: 'mismatched-public-client' }, () => assert.throws(() => appConfig({ config: base }), /Google.*match/i));
  }
});
test('TestFlight has native sample-unit mode, DNS capability, and Firebase-derived Google plugin', () => {
  assert.equal(profiles.testflight.environment, 'production');
  assert.equal(profiles.testflight.env.EXPO_PUBLIC_BUILD_CHANNEL, 'internal-testflight');
  assert.equal(profiles.testflight.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS, 'true');
  withEnvironment(internalEnv(), () => {
    const config = appConfig({ config: base });
    assert.ok(config.plugins.includes('@react-native-google-signin/google-signin'));
    const protection = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === './modules/freed-protection/app.plugin.js')[1];
    assert.equal(protection.releaseEnabled, true);
    assert.equal(protection.focusShieldReleaseEnabled, false);
    const generated = require('../modules/freed-protection/app.plugin').applyDnsEntitlements({}, protection);
    assert.deepEqual(generated['com.apple.developer.networking.networkextension'], ['dns-settings']);
    assert.equal(config.extra.build.channel, 'internal-testflight');
  });
});
test('production rejects internal channel, test ads, and mock configuration', () => {
  for (const override of [{ EXPO_PUBLIC_BUILD_CHANNEL: 'internal-testflight' }, { EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true' }, { EXPO_PUBLIC_MONETIZATION_MODE: 'mock' }]) {
    withEnvironment({ ...profiles.production.env, EAS_BUILD_PROFILE: 'production', ...override }, () => assert.throws(() => appConfig({ config: base }), /production/i));
  }
});
test('native plugin introspection derives Google callback and supported DNS entitlement without writing native files', async () => {
  const { withPlugins, compileModsAsync } = require('@expo/config-plugins');
  const configured = withEnvironment(internalEnv(), () => appConfig({ config: base }));
  const selected = configured.plugins.filter(plugin => plugin === '@react-native-google-signin/google-signin' || (Array.isArray(plugin) && plugin[0] === './modules/freed-protection/app.plugin.js'));
  const introspected = await compileModsAsync(withPlugins({ ...configured, _internal: { projectRoot: process.cwd() } }, selected), { projectRoot: process.cwd(), platforms: ['ios'], introspect: true });
  const results = introspected._internal.modResults.ios;
  assert.ok(results.infoPlist.CFBundleURLTypes.some(entry => entry.CFBundleURLSchemes.includes(internalEnv().EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME)));
  assert.equal(results.infoPlist.FreedEncryptedDnsReleaseEnabled, true);
  assert.ok(results.entitlements['com.apple.developer.networking.networkextension'].includes('dns-settings'));
});
test('actual production release preflight rejects the internal marker even with native mode and test ads disabled', () => {
  const { spawnSync } = require('node:child_process');
  const path = require('node:path');
  const { getPreflightCheckIds } = require('../scripts/release-env-preflight');
  for (const backend of ['firebase', 'legacy']) {
    for (const channel of [undefined, 'production', 'internal-testflight']) {
      const env = { PATH: process.env.PATH, EXPO_PUBLIC_BACKEND_PROVIDER: backend, EXPO_PUBLIC_MONETIZATION_MODE: 'native', EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'false' };
      if (channel !== undefined) env.EXPO_PUBLIC_BUILD_CHANNEL = channel;
      const result = spawnSync(process.execPath, [path.resolve('scripts/release-env-preflight.js')], { cwd: process.cwd(), env, encoding: 'utf8' });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      const checks = Object.fromEntries([...result.stdout.matchAll(/^\| (PASS|FAIL) \| ([a-z0-9-]+) \| (.*?) \|/gm)].map(match => [match[2], { status: match[1], detail: match[3] }]));
      for (const id of getPreflightCheckIds(backend)) assert.ok(checks[id], `Preflight must retain check ${id}`);
      assert.equal(checks['admob-test-ads-disabled'].status, 'PASS');
      assert.equal(checks['release-monetization-mode'].status, channel === 'internal-testflight' ? 'FAIL' : 'PASS');
      if (channel === 'internal-testflight') {
        assert.notEqual(result.status, 0);
        assert.match(checks['release-monetization-mode'].detail, /internal-testflight.*production/i);
      }
    }
  }
});
