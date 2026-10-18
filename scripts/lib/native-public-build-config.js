const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;

const GOOGLE_KEYS = ['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME'];
const CHANNELS = new Set(['development', 'internal', 'internal-testflight', 'production']);
function value(env, key) { return typeof env[key] === 'string' ? env[key].trim() : ''; }

/** Compare only public OAuth metadata; never read service-account or private env files. */
function validateGooglePublicBuildConfig(env, root) {
  if (GOOGLE_KEYS.some(key => !value(env, key))) throw new Error('Google public client configuration is required for native production/TestFlight builds. Supply all three EXPO_PUBLIC_GOOGLE_* inputs.');
  const ios = plist.parse(fs.readFileSync(path.join(root, 'ios/FREED/GoogleService-Info.plist'), 'utf8'));
  const android = JSON.parse(fs.readFileSync(path.join(root, 'android/app/google-services.json'), 'utf8'));
  const nativeClient = android.client?.find(client => client.client_info?.android_client_info?.package_name === 'app.freed.recovery');
  const webClients = (nativeClient?.oauth_client ?? []).filter(client => client.client_type === 3).map(client => client.client_id);
  const clientPattern = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;
  const web = value(env, GOOGLE_KEYS[0]);
  const iosClient = value(env, GOOGLE_KEYS[1]);
  const scheme = value(env, GOOGLE_KEYS[2]);
  if (!clientPattern.test(web) || !clientPattern.test(iosClient) || !webClients.includes(web) || ios.CLIENT_ID !== iosClient || ios.REVERSED_CLIENT_ID !== scheme || scheme !== `com.googleusercontent.apps.${iosClient.replace('.apps.googleusercontent.com', '')}` || ios.BUNDLE_ID !== 'app.freed.recovery' || ios.PROJECT_ID !== 'freed-7d5ee' || android.project_info?.project_id !== 'freed-7d5ee') {
    throw new Error('Google public client configuration must match the native Firebase service files and app identifiers.');
  }
}

function nativePublicBuildConfig(env = process.env, root = path.resolve(__dirname, '../..')) {
  const profile = value(env, 'EAS_BUILD_PROFILE');
  const channel = value(env, 'EXPO_PUBLIC_BUILD_CHANNEL') || (profile === 'testflight' ? '' : profile === 'production' ? 'production' : 'development');
  if (!CHANNELS.has(channel)) throw new Error('EXPO_PUBLIC_BUILD_CHANNEL must name development, internal, internal-testflight, or production.');
  const internalTestflight = channel === 'internal-testflight';
  if (profile === 'production' && (channel !== 'production' || value(env, 'EXPO_PUBLIC_ADMOB_USE_TEST_ADS') !== 'false' || value(env, 'EXPO_PUBLIC_MONETIZATION_MODE') !== 'native')) {
    throw new Error('Production builds require the production channel, native monetization, and explicitly disabled test ads.');
  }
  if (profile === 'testflight' && !internalTestflight) throw new Error('TestFlight builds require the explicit internal-testflight channel.');
  if (internalTestflight && (value(env, 'EXPO_PUBLIC_MONETIZATION_MODE') !== 'native' || value(env, 'EXPO_PUBLIC_ADMOB_USE_TEST_ADS') !== 'true')) {
    throw new Error('Internal TestFlight builds require native monetization and the explicit Google sample test-ad flag.');
  }
  const nativeStoreBuild = ['testflight', 'production'].includes(profile) || ['internal-testflight', 'production'].includes(channel);
  if (nativeStoreBuild && value(env, 'EAS_BUILD_PLATFORM') !== 'web' && value(env, 'EXPO_OS') !== 'web') validateGooglePublicBuildConfig(env, root);
  const dns = value(env, 'FREED_ENCRYPTED_DNS_RELEASE_ENABLED');
  if (dns && dns !== 'true' && dns !== 'false') throw new Error('FREED_ENCRYPTED_DNS_RELEASE_ENABLED must be true or false.');
  const websiteProbe = value(env, 'FREED_IOS_WEBSITE_RECOVERY_PROBE');
  if (websiteProbe && !['true', 'false'].includes(websiteProbe)) throw new Error('FREED_IOS_WEBSITE_RECOVERY_PROBE must be true or false.');
  if (websiteProbe === 'true' && !['development', 'internal-testflight'].includes(channel)) throw new Error('Website recovery probe is internal-only.');
  const recoveryPilot = value(env, 'FREED_RECOVERY_DNS_PILOT_ENABLED');
  if (recoveryPilot && !['true','false'].includes(recoveryPilot)) throw new Error('FREED_RECOVERY_DNS_PILOT_ENABLED must be true or false.');
  if (recoveryPilot === 'true' && !['development','internal','internal-testflight'].includes(channel)) throw new Error('Recovery DNS pilot is internal-only.');
  return { channel, internalTestflight, encryptedDnsReleaseEnabled: dns === 'true', websiteRecoveryProbeEnabled: websiteProbe === 'true', recoveryDnsPilotEnabled: recoveryPilot === 'true' };
}
module.exports = { nativePublicBuildConfig, validateGooglePublicBuildConfig };
