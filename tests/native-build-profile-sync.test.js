const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const plist = require('@expo/plist').default;
const { AndroidConfig } = require('@expo/config-plugins');
const profiles = require('../eas.json');
const script = path.resolve('scripts/sync-native-build-profile.js');
const targets = ['ios/FREED/Info.plist', 'ios/FREED/FREED.entitlements', 'android/app/src/main/AndroidManifest.xml'];
const extension = 'ios/FREEDShieldAction/FREEDShieldAction.entitlements';
const networkExtension = 'com.apple.developer.networking.networkextension';
const metadataPrefix = 'app.freed.protection.';
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-native-profile-'));
  function write(file, content) { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); }
  const publicIds = profiles.build.production.env;
  write('eas.json', JSON.stringify(profiles));
  write('ios/FREED/GoogleService-Info.plist', plist.build({ CLIENT_ID: publicIds.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, REVERSED_CLIENT_ID: publicIds.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME, BUNDLE_ID: 'app.freed.recovery', PROJECT_ID: 'freed-7d5ee' }));
  write('android/app/google-services.json', JSON.stringify({ project_info: { project_id: 'freed-7d5ee' }, client: [{ client_info: { android_client_info: { package_name: 'app.freed.recovery' } }, oauth_client: [{ client_type: 3, client_id: publicIds.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID }] }] }));
  write(targets[0], plist.build({ CFBundleURLTypes: [{ CFBundleURLSchemes: ['freed', publicIds.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME] }], FreedEncryptedDnsReleaseEnabled: false, FreedEncryptedDnsDevPreview: false, CustomExtensionSettings: { preserve: ['all', 'values'] } }));
  write(targets[1], plist.build({ [networkExtension]: ['packet-tunnel-provider'], 'com.apple.developer.family-controls': true, 'com.apple.security.application-groups': ['group.app.freed.recovery'], 'com.apple.developer.applesignin': ['Default'], CustomEntitlement: 'untouched' }));
  write(targets[2], `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="app.freed.recovery"><uses-permission android:name="fixture.permission"/><application android:name=".MainApplication"><meta-data android:name="${metadataPrefix}FOCUS_SHIELD_SURFACE_RELEASE_ENABLED" android:value="true"/><meta-data android:name="${metadataPrefix}FOCUS_SHIELD_SURFACE_DEV_PREVIEW" android:value="false"/><meta-data android:name="fixture.custom" android:value="preserve"/><activity android:name=".MainActivity"><intent-filter><data android:scheme="freed"/></intent-filter></activity><service android:name=".CustomService" android:exported="false"/></application></manifest>`);
  write(extension, 'custom extension entitlement bytes\n');
  return root;
}
function read(root, file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function snapshot(root) {
  const result = {};
  function visit(folder) { for (const entry of fs.readdirSync(folder, { withFileTypes: true })) { const item = path.join(folder, entry.name); if (entry.isDirectory()) visit(item); else result[path.relative(root, item)] = fs.readFileSync(item, 'utf8'); } }
  visit(root); return result;
}
function run(root, profile, env = {}) {
  return spawnSync(process.execPath, [script, ...(profile ? ['--profile', profile] : [])], { cwd: root, env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
}
async function nativeDocuments(root) { return { info: JSON.parse(JSON.stringify(plist.parse(read(root, targets[0])))), entitlements: JSON.parse(JSON.stringify(plist.parse(read(root, targets[1])))), manifest: await AndroidConfig.Manifest.readAndroidManifestAsync(path.join(root, targets[2])) }; }
function metadata(manifest, name) { return AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)['meta-data'].find(entry => entry.$['android:name'] === metadataPrefix + name)?.$['android:value']; }
function unrelatedManifest(manifest) { const clone = structuredClone(manifest); const app = AndroidConfig.Manifest.getMainApplicationOrThrow(clone); app['meta-data'] = app['meta-data'].filter(entry => !['ENCRYPTED_DNS_RELEASE_ENABLED', 'ENCRYPTED_DNS_DEV_PREVIEW', 'FOCUS_SHIELD_SURFACE_RELEASE_ENABLED', 'FOCUS_SHIELD_SURFACE_DEV_PREVIEW'].includes(entry.$['android:name'].replace(metadataPrefix, ''))); return clone; }

test('actual CLI materializes TestFlight then restores production while preserving unrelated native configuration', async () => {
  const root = fixture();
  try {
    const beforeFiles = snapshot(root);
    const before = await nativeDocuments(root);
    for (const [profile, enabled] of [['testflight', true], ['production', false]]) {
      const result = run(root, profile);
      assert.equal(result.status, 0, result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.profile, profile);
      assert.equal(report.encryptedDnsReleaseEnabled, enabled);
      assert.equal(report.encryptedDnsDevPreview, false);
      assert.equal(report.focusShieldReleaseEnabled, false);
      const after = await nativeDocuments(root);
      assert.deepEqual(after.info, { ...before.info, FreedEncryptedDnsReleaseEnabled: enabled, FreedEncryptedDnsDevPreview: false });
      assert.deepEqual(after.entitlements, { ...before.entitlements, [networkExtension]: enabled ? ['packet-tunnel-provider', 'dns-settings'] : ['packet-tunnel-provider'] });
      assert.equal(metadata(after.manifest, 'ENCRYPTED_DNS_RELEASE_ENABLED'), String(enabled));
      assert.equal(metadata(after.manifest, 'ENCRYPTED_DNS_DEV_PREVIEW'), 'false');
      assert.equal(metadata(after.manifest, 'FOCUS_SHIELD_SURFACE_RELEASE_ENABLED'), 'false');
      assert.deepEqual(unrelatedManifest(after.manifest), unrelatedManifest(before.manifest));
      const afterFiles = snapshot(root);
      for (const [file, content] of Object.entries(beforeFiles)) if (!targets.includes(file)) assert.equal(afterFiles[file], content, file);
      const repeated = run(root, profile);
      assert.equal(repeated.status, 0, repeated.stderr);
      assert.deepEqual(JSON.parse(repeated.stdout).changedFiles, []);
      assert.deepEqual(snapshot(root), afterFiles);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('EAS hook command consumes its explicit build profile and invalid production inputs write no native file', () => {
  const root = fixture();
  try {
    const hook = require('../package.json').scripts['eas-build-post-install'];
    assert.equal(typeof hook, 'string');
    const [runtime, entry, ...hookArgs] = hook.split(' ');
    const result = spawnSync(runtime === 'node' ? process.execPath : runtime, [path.resolve(entry), ...hookArgs], { cwd: root, env: { PATH: process.env.PATH, EAS_BUILD_PROFILE: 'testflight', EAS_BUILD_PLATFORM: 'ios' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).encryptedDnsReleaseEnabled, true);
    const beforeInvalid = snapshot(root);
    for (const env of [{ EXPO_PUBLIC_BUILD_CHANNEL: 'internal-testflight', EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'false' }, { EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true' }, { EXPO_PUBLIC_MONETIZATION_MODE: 'mock' }, { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'mismatched-public-client' }, { FREED_ENCRYPTED_DNS_DEV_PREVIEW: 'true' }]) {
      const rejected = run(root, 'production', env);
      assert.notEqual(rejected.status, 0);
      assert.deepEqual(snapshot(root), beforeInvalid);
    }
    const missingProfile = run(root);
    assert.notEqual(missingProfile.status, 0);
    assert.match(missingProfile.stderr, /profile/i);
    assert.deepEqual(snapshot(root), beforeInvalid);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
