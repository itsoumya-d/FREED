const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { AndroidConfig } = require('@expo/config-plugins');
const XML = require('@expo/config-plugins/build/utils/XML');
const { nativePublicBuildConfig } = require('./lib/native-public-build-config');
const { sanitizeLocalHomePaths } = require('./lib/local-path-privacy');
const { applyDnsInfoPlist, applyDnsEntitlements, applyDnsAndroidMetadata, applyFocusShieldAndroidMetadata } = require('../modules/freed-protection/app.plugin');

// Only these build inputs are consumed. No .env files or server credentials are read.
const INPUTS = [
  'EXPO_PUBLIC_BUILD_CHANNEL', 'EXPO_PUBLIC_MONETIZATION_MODE', 'EXPO_PUBLIC_ADMOB_USE_TEST_ADS',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME',
  'FREED_ENCRYPTED_DNS_RELEASE_ENABLED', 'FREED_ENCRYPTED_DNS_DEV_PREVIEW', 'FREED_FOCUS_SHIELD_DEV_PREVIEW',
  'EAS_BUILD_PLATFORM'
];
const FILES = { info: 'ios/FREED/Info.plist', entitlements: 'ios/FREED/FREED.entitlements', manifest: 'android/app/src/main/AndroidManifest.xml' };
function publicInputs(env) { return Object.fromEntries(INPUTS.filter(key => typeof env[key] === 'string').map(key => [key, env[key]])); }
function resolveProfileEnvironment(profiles, name, seen = new Set()) {
  if (seen.has(name)) throw new Error('EAS build profiles contain a circular inheritance chain.');
  const profile = profiles[name];
  if (!profile) throw new Error('The selected build profile does not exist in eas.json.');
  seen.add(name);
  const inherited = profile.extends ? resolveProfileEnvironment(profiles, profile.extends, seen) : {};
  return { ...inherited, ...publicInputs(profile.env ?? {}) };
}
function booleanInput(env, name) {
  const value = env[name]?.trim();
  if (value && value !== 'true' && value !== 'false') throw new Error(`${name} must be true or false.`);
  return value === 'true';
}
function parseProfile(argv, env) {
  let explicit;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== '--profile' || explicit !== undefined || !argv[index + 1]) throw new Error('Usage: node scripts/sync-native-build-profile.js --profile <build-profile>, or set EAS_BUILD_PROFILE in EAS.');
    explicit = argv[++index];
  }
  const current = env.EAS_BUILD_PROFILE?.trim();
  if (explicit && current && explicit !== current) throw new Error('The explicit profile must match EAS_BUILD_PROFILE when running in EAS.');
  const profile = explicit ?? current;
  if (!profile || !/^[a-z][a-z0-9-]*$/.test(profile)) throw new Error('An explicit --profile or EAS_BUILD_PROFILE is required.');
  return profile;
}

async function syncNativeBuildProfile({ root = process.cwd(), profile, environment = process.env }) {
  const profiles = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')).build;
  const inputs = { ...resolveProfileEnvironment(profiles, profile), ...publicInputs(environment), EAS_BUILD_PROFILE: profile };
  if (inputs.EAS_BUILD_PLATFORM && !['ios', 'android'].includes(inputs.EAS_BUILD_PLATFORM)) throw new Error('Native build profile synchronization requires an iOS or Android build platform.');
  const build = nativePublicBuildConfig(inputs, root);
  const options = {
    releaseEnabled: build.encryptedDnsReleaseEnabled,
    devPreview: booleanInput(inputs, 'FREED_ENCRYPTED_DNS_DEV_PREVIEW'),
    focusShieldReleaseEnabled: false,
    focusShieldDevPreview: booleanInput(inputs, 'FREED_FOCUS_SHIELD_DEV_PREVIEW')
  };
  if (profile === 'production' && (options.releaseEnabled || options.devPreview || options.focusShieldDevPreview)) throw new Error('The production profile must keep DNS capability and native protection previews disabled.');

  // Parse and validate every target before writing any target. Existing native
  // extension projects, identities, callbacks and unrelated entitlements stay intact.
  const info = plist.parse(fs.readFileSync(path.join(root, FILES.info), 'utf8'));
  const entitlements = plist.parse(fs.readFileSync(path.join(root, FILES.entitlements), 'utf8'));
  const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(path.join(root, FILES.manifest));
  const originals = { info: JSON.stringify(info), entitlements: JSON.stringify(entitlements), manifest: JSON.stringify(manifest) };
  applyDnsInfoPlist(info, options);
  applyDnsEntitlements(entitlements, options);
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  applyDnsAndroidMetadata(application, options);
  applyFocusShieldAndroidMetadata(application, options);
  const documents = { info, entitlements, manifest };
  const changedFiles = [];
  const writes = Object.entries(documents).filter(([key, document]) => JSON.stringify(document) !== originals[key]).map(([key, document]) => ({ file: FILES[key], content: key === 'manifest' ? XML.format(document) : plist.build(document) }));
  for (const { file, content } of writes) {
    fs.writeFileSync(path.join(root, file), content);
    changedFiles.push(file);
  }
  return { schema: 'freed-native-build-profile-v1', sanitized: true, profile, channel: build.channel, encryptedDnsReleaseEnabled: options.releaseEnabled, encryptedDnsDevPreview: options.devPreview, focusShieldReleaseEnabled: false, focusShieldDevPreview: options.focusShieldDevPreview, changedFiles };
}
module.exports = { syncNativeBuildProfile, resolveProfileEnvironment };
if (require.main === module) {
  (async () => {
    const profile = parseProfile(process.argv.slice(2), process.env);
    console.log(JSON.stringify(await syncNativeBuildProfile({ profile })));
  })().catch(error => {
    console.error(sanitizeLocalHomePaths(error instanceof Error ? error.message : 'Native build profile synchronization failed.'));
    process.exitCode = 1;
  });
}
