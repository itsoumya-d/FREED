const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const helperPath = path.join(projectRoot, 'scripts/lib/internal-native-build-env.js');
const profiles = require('../eas.json');
const dnsEntitlement = 'com.apple.developer.networking.networkextension';
const expectedNative = {
  FREED_ENCRYPTED_DNS_RELEASE_ENABLED: 'true',
  FREED_ENCRYPTED_DNS_DEV_PREVIEW: 'false',
  FREED_FOCUS_SHIELD_DEV_PREVIEW: 'false'
};
function helper() {
  return require(helperPath);
}
function resolve(options = {}) {
  return helper().resolveInternalNativeBuildEnv({ root: projectRoot, profile: 'testflight', ...options });
}

// Exercises the actual app config and plugin compiler in an empty child environment.
// Unlike syncNativeBuildProfile, this path cannot recover a dropped flag from EAS.
function introspect(candidate) {
  const source = `
    const { withPlugins, compileModsAsync } = require('@expo/config-plugins');
    const appConfig = require('./app.config');
    const config = appConfig({ config: require('./app.json').expo });
    const protection = config.plugins.filter(plugin => Array.isArray(plugin) && plugin[0] === './modules/freed-protection/app.plugin.js');
    compileModsAsync(withPlugins({ ...config, _internal: { projectRoot: process.cwd() } }, protection), {
      projectRoot: process.cwd(), platforms: ['ios'], introspect: true
    }).then(result => console.log(JSON.stringify(result._internal.modResults.ios))).catch(() => { process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ['-e', source], {
    cwd: projectRoot, env: candidate.buildEnvironment, encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  const generated = JSON.parse(result.stdout);
  return { infoPlist: generated.infoPlist, entitlements: generated.entitlements };
}

test('candidate helper repairs the old public-only omission through actual plugin-generated plist and entitlements', () => {
  const inherited = { ...profiles.build.production.env, ...profiles.build.testflight.env };
  const oldPublicOnly = Object.fromEntries(Object.entries(inherited).filter(([key]) => key.startsWith('EXPO_PUBLIC_')));
  assert.equal(inherited.FREED_ENCRYPTED_DNS_RELEASE_ENABLED, 'true');
  assert.equal(oldPublicOnly.FREED_ENCRYPTED_DNS_RELEASE_ENABLED, undefined);
  const oldArtifact = introspect({ buildEnvironment: { ...oldPublicOnly, EAS_BUILD_PROFILE: 'testflight', EAS_BUILD_PLATFORM: 'ios' } });
  assert.equal(oldArtifact.infoPlist.FreedEncryptedDnsReleaseEnabled, false);
  assert.equal(oldArtifact.entitlements[dnsEntitlement]?.includes('dns-settings') ?? false, false);

  const candidate = resolve({ publicEnvironment: { EXPO_PUBLIC_BACKEND_PROVIDER: 'firebase', EXPO_PUBLIC_STORE_PROVIDER: 'native', EXPO_PUBLIC_IAP_PRODUCT_MONTHLY: 'freed_monthly' } });
  assert.equal(candidate.sanitized, true);
  assert.deepEqual(candidate.nativeEnvironment, expectedNative);
  assert.equal(candidate.publicEnvironment.FREED_ENCRYPTED_DNS_RELEASE_ENABLED, undefined);
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_BUILD_CHANNEL, 'internal-testflight');
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_MONETIZATION_MODE, 'native');
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_ADMOB_USE_TEST_ADS, 'true');
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, '5477978760-ussf6lsalc0h97ra505g8hfe6h7h5ns8.apps.googleusercontent.com');
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_BACKEND_PROVIDER, 'firebase');
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_STORE_PROVIDER, 'native');
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_IAP_PRODUCT_MONTHLY, 'freed_monthly');
  assert.deepEqual(candidate.buildEnvironment, { ...candidate.publicEnvironment, ...expectedNative, EAS_BUILD_PROFILE: 'testflight', EAS_BUILD_PLATFORM: 'ios' });
  const artifact = introspect(candidate);
  assert.equal(artifact.infoPlist.FreedEncryptedDnsReleaseEnabled, true);
  assert.equal(artifact.infoPlist.FreedEncryptedDnsDevPreview, false);
  assert.ok(artifact.entitlements[dnsEntitlement].includes('dns-settings'));
  assert.doesNotThrow(() => helper().assertNativeArtifactConfiguration(candidate.artifactExpectation, artifact));
});

test('production keeps DNS disabled in the returned environment and actual plugin output', () => {
  const candidate = resolve({ profile: 'production', nativeOverrides: { FREED_ENCRYPTED_DNS_RELEASE_ENABLED: 'false' } });
  assert.deepEqual(candidate.nativeEnvironment, { ...expectedNative, FREED_ENCRYPTED_DNS_RELEASE_ENABLED: 'false' });
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_BUILD_CHANNEL, 'production');
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_ADMOB_USE_TEST_ADS, 'false');
  const artifact = introspect(candidate);
  assert.equal(artifact.infoPlist.FreedEncryptedDnsReleaseEnabled, false);
  assert.equal(artifact.infoPlist.FreedEncryptedDnsDevPreview, false);
  assert.equal(artifact.entitlements[dnsEntitlement]?.includes('dns-settings') ?? false, false);
  assert.doesNotThrow(() => helper().assertNativeArtifactConfiguration(candidate.artifactExpectation, artifact));
});

function fixture(t, change = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-candidate-env-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = structuredClone(profiles);
  change(config);
  fs.writeFileSync(path.join(root, 'eas.json'), JSON.stringify(config));
  for (const file of ['src/lib/public-client-env.ts', 'ios/FREED/GoogleService-Info.plist', 'android/app/google-services.json']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, file), path.join(root, file));
  }
  return root;
}

test('valid explicit native overrides survive while cross-profile DNS intent is rejected before compilation', t => {
  assert.deepEqual(resolve({ nativeOverrides: expectedNative }).nativeEnvironment, expectedNative);
  const root = fixture(t);
  const info = path.join(root, 'ios/FREED/Info.plist');
  fs.writeFileSync(info, 'native fixture bytes must stay intact');
  let compilationReached = false;
  assert.throws(() => {
    const candidate = resolve({ root, nativeOverrides: { FREED_ENCRYPTED_DNS_RELEASE_ENABLED: 'false' } });
    compilationReached = true;
    introspect(candidate);
  }, /TestFlight.*DNS.*enabled/i);
  assert.equal(compilationReached, false);
  assert.equal(fs.readFileSync(info, 'utf8'), 'native fixture bytes must stay intact');
  assert.throws(() => resolve({ profile: 'production', nativeOverrides: { FREED_ENCRYPTED_DNS_RELEASE_ENABLED: 'true' } }), /production.*DNS.*disabled/i);
});

test('native inputs reject malformed booleans, preview enablement, and unknown flags without echoing values', () => {
  const secret = 'synthetic-native-secret-do-not-print';
  for (const key of Object.keys(expectedNative)) {
    for (const value of ['TRUE', ' true ', '', true, null, secret]) {
      assert.throws(() => resolve({ nativeOverrides: { [key]: value } }), error => /native.*true.*false/i.test(error.message) && !error.message.includes(secret));
    }
  }
  for (const key of ['FREED_ENCRYPTED_DNS_DEV_PREVIEW', 'FREED_FOCUS_SHIELD_DEV_PREVIEW']) {
    assert.throws(() => resolve({ nativeOverrides: { [key]: 'true' } }), /native.*preview.*disabled/i);
  }
  for (const key of ['FREED_FOCUS_SHIELD_RELEASE_ENABLED', 'FREED_NATIVE_SECURITY_PREVIEW', 'FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES', 'OPENAI_API_KEY']) {
    assert.throws(() => resolve({ nativeOverrides: { [key]: secret } }), error => /unapproved native/i.test(error.message) && !error.message.includes(secret));
  }
});

test('supplied public inputs reject credentials, debug providers, undeclared keys, and misplaced native flags', () => {
  const secret = 'synthetic-public-secret-do-not-print';
  for (const key of ['OPENAI_API_KEY', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'EXPO_PUBLIC_OPENAI_API_KEY', 'EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN', 'EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_PROVIDER', 'EXPO_PUBLIC_UNDECLARED_CONFIG', 'EAS_BUILD_PROFILE', 'FREED_ENCRYPTED_DNS_RELEASE_ENABLED']) {
    assert.throws(() => resolve({ publicEnvironment: { [key]: secret } }), error => /unapproved public/i.test(error.message) && !error.message.includes(secret));
  }
  assert.throws(() => resolve({ publicEnvironment: { EXPO_PUBLIC_IAP_PRODUCT_MONTHLY: { secret } } }), error => /public.*string/i.test(error.message) && !error.message.includes(secret));
});

test('selected profile refuses conflicting channel, ads, monetization, emulator, or Google inputs', () => {
  for (const publicEnvironment of [
    { EXPO_PUBLIC_BUILD_CHANNEL: 'production' },
    { EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'false' },
    { EXPO_PUBLIC_MONETIZATION_MODE: 'mock' },
    { EXPO_PUBLIC_FIREBASE_USE_EMULATORS: 'true' },
    { EXPO_PUBLIC_FIREBASE_ENV: 'staging' },
    { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'synthetic-google-secret-do-not-print' }
  ]) {
    assert.throws(() => resolve({ publicEnvironment }), error => /configuration/i.test(error.message) && !error.message.includes('synthetic-google-secret-do-not-print'));
  }
  for (const publicEnvironment of [{ EXPO_PUBLIC_BUILD_CHANNEL: 'internal-testflight' }, { EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true' }, { EXPO_PUBLIC_MONETIZATION_MODE: 'mock' }]) {
    assert.throws(() => resolve({ profile: 'production', publicEnvironment }), /configuration/i);
  }
});

test('inherited profiles resolve recursively without allowing server environment or unknown native flags', t => {
  const root = fixture(t, config => {
    config.build.approvedbase = structuredClone(config.build.production);
    config.build.production = { extends: 'approvedbase', env: { EXPO_PUBLIC_IAP_PRODUCT_YEARLY: 'freed_yearly' } };
  });
  const candidate = resolve({ root });
  assert.equal(candidate.nativeEnvironment.FREED_ENCRYPTED_DNS_RELEASE_ENABLED, 'true');
  assert.equal(candidate.publicEnvironment.EXPO_PUBLIC_IAP_PRODUCT_YEARLY, 'freed_yearly');
  const secret = 'synthetic-inherited-secret-do-not-print';
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_PROVIDER', 'FREED_SECURITY_DEV_PREVIEW']) {
    const rejected = fixture(t, config => { config.build.production.env[key] = secret; });
    assert.throws(() => resolve({ root: rejected }), error => /unapproved.*profile/i.test(error.message) && !error.message.includes(secret));
  }
});

test('invalid inherited native flags fail even when a child or explicit override hides them', t => {
  for (const env of [
    { FREED_ENCRYPTED_DNS_RELEASE_ENABLED: 'invalid-native-secret' },
    { FREED_ENCRYPTED_DNS_DEV_PREVIEW: 'true' },
    { FREED_FOCUS_SHIELD_DEV_PREVIEW: 'invalid-native-secret' }
  ]) {
    const root = fixture(t, config => { Object.assign(config.build.production.env, env); });
    assert.throws(() => resolve({ root, nativeOverrides: expectedNative }), error => /native/i.test(error.message) && !error.message.includes('invalid-native-secret'));
  }
});

test('missing, malformed, unsupported, and cyclic build profiles fail with sanitized errors', t => {
  for (const profile of [undefined, null, '', 'internal', 'development', 'testflight/secret-profile']) {
    assert.throws(() => resolve({ profile }), error => /profile/i.test(error.message) && !error.message.includes('secret-profile'));
  }
  for (const change of [
    config => { delete config.build.testflight; },
    config => { config.build.production.extends = 'testflight'; },
    config => { config.build.testflight.extends = 'missing-profile-secret'; },
    config => { config.build.testflight.env = []; },
    config => { config.build.testflight = 'malformed-profile-secret'; },
    config => { config.build.testflight.extends = 42; },
    config => { delete config.build.testflight.env.FREED_ENCRYPTED_DNS_RELEASE_ENABLED; }
  ]) {
    const root = fixture(t, change);
    assert.throws(() => resolve({ root }), error => /profile|TestFlight.*DNS/i.test(error.message) && !error.message.includes('profile-secret'));
  }
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'eas.json'), '{invalid-json-secret');
  assert.throws(() => resolve({ root }), error => /profile/i.test(error.message) && !error.message.includes('invalid-json-secret'));
  assert.throws(() => resolve({ platform: 'web' }), /native.*platform/i);
});

test('candidate helper ignores ambient secrets and uses no private env files', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.env.production'));
  const keys = ['OPENAI_API_KEY', 'FREED_ENCRYPTED_DNS_RELEASE_ENABLED', 'EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { OPENAI_API_KEY: 'synthetic-ambient-secret', FREED_ENCRYPTED_DNS_RELEASE_ENABLED: 'false', EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN: 'synthetic-ambient-secret' });
  try {
    const candidate = resolve({ root });
    assert.equal(candidate.nativeEnvironment.FREED_ENCRYPTED_DNS_RELEASE_ENABLED, 'true');
    assert.equal(candidate.buildEnvironment.OPENAI_API_KEY, undefined);
    assert.equal(candidate.buildEnvironment.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN, undefined);
    assert.doesNotMatch(JSON.stringify(candidate), /synthetic-ambient-secret/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('exported artifact gate requires actual boolean DNS true, previews false, and effective dns-settings entitlement', () => {
  const candidate = resolve();
  const correct = { infoPlist: { FreedEncryptedDnsReleaseEnabled: true, FreedEncryptedDnsDevPreview: false }, entitlements: { [dnsEntitlement]: ['dns-settings'] } };
  assert.doesNotThrow(() => helper().assertNativeArtifactConfiguration(candidate.artifactExpectation, correct));
  for (const artifact of [
    { ...correct, infoPlist: { ...correct.infoPlist, FreedEncryptedDnsReleaseEnabled: false } },
    { ...correct, infoPlist: { FreedEncryptedDnsDevPreview: false } },
    { ...correct, infoPlist: { ...correct.infoPlist, FreedEncryptedDnsReleaseEnabled: 'true' } },
    { ...correct, infoPlist: { ...correct.infoPlist, FreedEncryptedDnsDevPreview: true } },
    { ...correct, infoPlist: { FreedEncryptedDnsReleaseEnabled: true } },
    { ...correct, entitlements: {} },
    { ...correct, entitlements: { [dnsEntitlement]: ['packet-tunnel-provider'] } },
    { ...correct, entitlements: { [dnsEntitlement]: 'dns-settings' } }
  ]) {
    assert.throws(() => helper().assertNativeArtifactConfiguration(candidate.artifactExpectation, artifact), /artifact/i);
  }
  const secretArtifact = { infoPlist: { FreedEncryptedDnsReleaseEnabled: 'synthetic-artifact-secret' }, entitlements: {} };
  assert.throws(() => helper().assertNativeArtifactConfiguration(candidate.artifactExpectation, secretArtifact), error => /artifact/i.test(error.message) && !error.message.includes('synthetic-artifact-secret'));
  const production = resolve({ profile: 'production' });
  assert.throws(() => helper().assertNativeArtifactConfiguration(production.artifactExpectation, correct), /artifact/i);
  assert.throws(() => helper().assertNativeArtifactConfiguration({ ...candidate.artifactExpectation, infoPlist: { FreedEncryptedDnsReleaseEnabled: false, FreedEncryptedDnsDevPreview: false } }, correct), /expectation/i);
});

test('returned artifact expectation cannot be weakened after candidate environment selection', () => {
  const expectation = resolve().artifactExpectation;
  Reflect.set(expectation.infoPlist, 'FreedEncryptedDnsReleaseEnabled', false);
  Reflect.set(expectation.infoPlist, 'FreedEncryptedDnsDevPreview', true);
  Reflect.set(expectation, 'dnsSettingsEntitlement', false);
  Reflect.set(expectation, 'profile', 'production');
  assert.equal(expectation.profile, 'testflight');
  assert.equal(expectation.infoPlist.FreedEncryptedDnsReleaseEnabled, true);
  assert.equal(expectation.infoPlist.FreedEncryptedDnsDevPreview, false);
  assert.equal(expectation.dnsSettingsEntitlement, true);
  assert.doesNotThrow(() => helper().assertNativeArtifactConfiguration(expectation, {
    infoPlist: { FreedEncryptedDnsReleaseEnabled: true, FreedEncryptedDnsDevPreview: false },
    entitlements: { [dnsEntitlement]: ['dns-settings'] }
  }));
});
