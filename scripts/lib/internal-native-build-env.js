const fs = require('node:fs');
const path = require('node:path');
const { nativePublicBuildConfig } = require('./native-public-build-config');

const NATIVE_KEYS = Object.freeze([
  'FREED_ENCRYPTED_DNS_RELEASE_ENABLED',
  'FREED_ENCRYPTED_DNS_DEV_PREVIEW',
  'FREED_FOCUS_SHIELD_DEV_PREVIEW'
]);
const DNS_ENTITLEMENT = 'com.apple.developer.networking.networkextension';
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function publicKeys(root) {
  let source;
  try { source = fs.readFileSync(path.join(root, 'src/lib/public-client-env.ts'), 'utf8'); }
  catch { throw new Error('The declared public client configuration is unavailable.'); }
  const keys = [...source.matchAll(/case "(EXPO_PUBLIC_[A-Z0-9_]+)"/g)].map(match => match[1]);
  // A declared debug credential is still forbidden in a signed candidate.
  const approved = keys.filter(key => !/(?:DEBUG|TOKEN|SECRET|PRIVATE_KEY|SERVICE_ACCOUNT|SERVICE_ROLE|PASSWORD)/.test(key));
  if (!approved.length) throw new Error('The declared public client configuration is unavailable.');
  return new Set(approved);
}

function validateNativeValue(key, value) {
  if (value !== 'true' && value !== 'false') throw new Error('Native build inputs must use the exact strings true or false.');
  if (key !== NATIVE_KEYS[0] && value !== 'false') throw new Error('Native protection previews must remain disabled in signed candidates.');
}

function validateEnvironment(environment, allowedPublic, scope) {
  if (!isMap(environment)) throw new Error(`${scope} environment must be a key/value map.`);
  for (const [key, value] of Object.entries(environment)) {
    if (scope === 'EAS build profile' && NATIVE_KEYS.includes(key)) validateNativeValue(key, value);
    else if (!allowedPublic.has(key)) throw new Error(`Unapproved ${scope} environment input.`);
    else if (typeof value !== 'string') throw new Error(`${scope} environment values must be strings.`);
  }
}

function profileEnvironment(profiles, name, allowedPublic, seen = new Set()) {
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name) || !isMap(profiles) || !hasOwn(profiles, name) || !isMap(profiles[name])) throw new Error('The selected EAS build profile or inherited profile is invalid.');
  if (seen.has(name)) throw new Error('EAS build profiles contain circular inheritance.');
  seen.add(name);
  const profile = profiles[name];
  const own = profile.env === undefined ? {} : profile.env;
  validateEnvironment(own, allowedPublic, 'EAS build profile');
  const inherited = profile.extends === undefined ? {} : profileEnvironment(profiles, profile.extends, allowedPublic, seen);
  return { ...inherited, ...own };
}

function artifactExpectation(profile) {
  const enabled = profile === 'testflight';
  return Object.freeze({
    schema: 'freed-native-artifact-expectation-v1',
    profile,
    infoPlist: Object.freeze({ FreedEncryptedDnsReleaseEnabled: enabled, FreedEncryptedDnsDevPreview: false }),
    dnsSettingsEntitlement: enabled
  });
}

/**
 * Accept only already-public caller inputs. Read EAS configuration, the audited
 * client allowlist, and public Google metadata; never read a private env file or
 * inherit process.env. Native flags deliberately bypass the EXPO_PUBLIC filter.
 * The caller supplies its separately approved host/toolchain environment.
 */
function resolveInternalNativeBuildEnv({ root = path.resolve(__dirname, '../..'), profile, platform = 'ios', publicEnvironment = {}, nativeOverrides = {} } = {}) {
  if (!['testflight', 'production'].includes(profile)) throw new Error('An explicit testflight or production candidate profile is required.');
  if (!['ios', 'android'].includes(platform)) throw new Error('A signed candidate requires a native iOS or Android platform.');
  const allowedPublic = publicKeys(root);
  let profiles;
  try { profiles = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')).build; }
  catch { throw new Error('EAS build profile configuration is unavailable or malformed.'); }
  const inherited = profileEnvironment(profiles, profile, allowedPublic);
  validateEnvironment(publicEnvironment, allowedPublic, 'public');
  if (!isMap(nativeOverrides)) throw new Error('Native overrides must be a key/value map.');
  for (const [key, value] of Object.entries(nativeOverrides)) {
    if (!NATIVE_KEYS.includes(key)) throw new Error('Unapproved native build override.');
    validateNativeValue(key, value);
  }
  const publicInputs = {
    ...Object.fromEntries(Object.entries(inherited).filter(([key]) => allowedPublic.has(key))),
    ...publicEnvironment
  };
  const nativeInputs = {
    FREED_ENCRYPTED_DNS_DEV_PREVIEW: 'false',
    FREED_FOCUS_SHIELD_DEV_PREVIEW: 'false',
    ...Object.fromEntries(Object.entries(inherited).filter(([key]) => NATIVE_KEYS.includes(key))),
    ...nativeOverrides
  };
  if (profile === 'testflight' && nativeInputs.FREED_ENCRYPTED_DNS_RELEASE_ENABLED !== 'true') throw new Error('TestFlight candidate DNS capability must be enabled.');
  if (profile === 'production' && nativeInputs.FREED_ENCRYPTED_DNS_RELEASE_ENABLED !== 'false') throw new Error('Production candidate DNS capability must remain disabled.');
  const channel = profile === 'testflight' ? 'internal-testflight' : 'production';
  const testAds = profile === 'testflight' ? 'true' : 'false';
  if (publicInputs.EXPO_PUBLIC_BUILD_CHANNEL !== channel || publicInputs.EXPO_PUBLIC_MONETIZATION_MODE !== 'native' || publicInputs.EXPO_PUBLIC_ADMOB_USE_TEST_ADS !== testAds || publicInputs.EXPO_PUBLIC_FIREBASE_ENV !== 'production' || (hasOwn(publicInputs, 'EXPO_PUBLIC_FIREBASE_USE_EMULATORS') && publicInputs.EXPO_PUBLIC_FIREBASE_USE_EMULATORS !== 'false')) throw new Error('Public native build configuration conflicts with the selected candidate profile.');
  const buildEnvironment = { ...publicInputs, ...nativeInputs, EAS_BUILD_PROFILE: profile, EAS_BUILD_PLATFORM: platform };
  // Sanitize parse/validation failures, including any caller-supplied values.
  try { nativePublicBuildConfig(buildEnvironment, root); }
  catch { throw new Error('Public native build configuration must match the approved Google app configuration.'); }
  return { schema: 'freed-internal-native-build-env-v1', sanitized: true, profile, publicEnvironment: publicInputs, nativeEnvironment: nativeInputs, buildEnvironment, artifactExpectation: artifactExpectation(profile) };
}

/** Check decoded exported Info.plist and effective signed app entitlements.
 * This is an additional capability gate; callers retain all signing/extension
 * gates and device verification. Source files or env values are not evidence.
 */
function assertNativeArtifactConfiguration(expectation, { infoPlist, entitlements } = {}) {
  if (!isMap(expectation) || !['testflight', 'production'].includes(expectation.profile)) throw new Error('The native artifact expectation is invalid.');
  const expected = artifactExpectation(expectation.profile);
  if (expectation.schema !== expected.schema || !isMap(expectation.infoPlist) || expectation.infoPlist.FreedEncryptedDnsReleaseEnabled !== expected.infoPlist.FreedEncryptedDnsReleaseEnabled || expectation.infoPlist.FreedEncryptedDnsDevPreview !== false || expectation.dnsSettingsEntitlement !== expected.dnsSettingsEntitlement) throw new Error('The native artifact expectation conflicts with its candidate profile.');
  if (!isMap(infoPlist) || !isMap(entitlements) || infoPlist.FreedEncryptedDnsReleaseEnabled !== expected.infoPlist.FreedEncryptedDnsReleaseEnabled || infoPlist.FreedEncryptedDnsDevPreview !== false) throw new Error('The exported native artifact has missing or mismatched DNS capability or preview flags.');
  const network = entitlements[DNS_ENTITLEMENT];
  if (network !== undefined && (!Array.isArray(network) || network.some(value => typeof value !== 'string'))) throw new Error('The exported native artifact has malformed effective network entitlements.');
  if ((network?.includes('dns-settings') ?? false) !== expected.dnsSettingsEntitlement) throw new Error('The exported native artifact DNS settings entitlement conflicts with its candidate profile.');
  return { sanitized: true, profile: expectation.profile, encryptedDnsReleaseEnabled: expected.infoPlist.FreedEncryptedDnsReleaseEnabled, encryptedDnsDevPreview: false, dnsSettingsEntitlement: expected.dnsSettingsEntitlement };
}

module.exports = { resolveInternalNativeBuildEnv, assertNativeArtifactConfiguration };
