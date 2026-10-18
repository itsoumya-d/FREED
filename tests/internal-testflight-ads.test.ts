import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configureNativeMonetizationBuild, configureNativeMonetizationProvider, createRewardedResetSession, getMonetizationConfig, isRewardedAdSdkConfigured } from '../src/lib/monetization';
import { createNativeSdkMonetizationProvider } from '../src/lib/native-monetization-runtime';

const envKeys = ['NODE_ENV', 'EXPO_PUBLIC_BUILD_CHANNEL', 'EXPO_PUBLIC_MONETIZATION_MODE', 'EXPO_PUBLIC_ADMOB_USE_TEST_ADS', 'EXPO_PUBLIC_ADMOB_APP_ID_IOS', 'EXPO_PUBLIC_ADMOB_APP_ID_ANDROID'];
const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
function configure(channel: string, debug: boolean | null = false) {
  configureNativeMonetizationBuild(debug);
  Object.assign(process.env, { NODE_ENV: 'production', EXPO_PUBLIC_BUILD_CHANNEL: channel, EXPO_PUBLIC_MONETIZATION_MODE: 'native', EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true', EXPO_PUBLIC_ADMOB_APP_ID_IOS: 'ca-app-pub-1234567890123456~1234567890', EXPO_PUBLIC_ADMOB_APP_ID_ANDROID: 'ca-app-pub-1234567890123456~1234567890' });
}
test('sample rewarded ads require explicit internal native release channel and never permit mock premium', () => {
  try {
    configure('internal-testflight');
    for (const platform of ['ios', 'android'] as const) assert.equal(isRewardedAdSdkConfigured(getMonetizationConfig({ platform })), true);
    assert.equal(getMonetizationConfig({ platform: 'ios', mode: 'mock' }).mode, 'native');
    assert.equal(isRewardedAdSdkConfigured(getMonetizationConfig({ platform: 'web' })), false);
    configure('production');
    assert.equal(isRewardedAdSdkConfigured(getMonetizationConfig({ platform: 'ios' })), false);
    configure('testflight');
    assert.equal(isRewardedAdSdkConfigured(getMonetizationConfig({ platform: 'ios' })), false);
    configure('internal-testflight', true);
    assert.equal(getMonetizationConfig({ platform: 'ios', mode: 'mock' }).mode, 'native');
    assert.equal(isRewardedAdSdkConfigured(getMonetizationConfig({ platform: 'ios' })), false);
    configure('internal-testflight', null);
    assert.equal(isRewardedAdSdkConfigured(getMonetizationConfig({ platform: 'ios' })), false);
  } finally { restore(); }
});
test('internal TestFlight requests the real SDK sample reward unit with no recovery context and Premium requests none', async () => {
  try {
    configure('internal-testflight');
    const requests: Array<{ unit: string; options: unknown }> = [];
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const provider = await createNativeSdkMonetizationProvider({ platform: 'ios', loader: async name => name === 'react-native-google-mobile-ads' ? {
      default: () => ({ initialize: async () => undefined }),
      AdsConsent: { gatherConsent: async () => ({ canRequestAds: true }) },
      TestIds: { REWARDED: 'ca-app-pub-3940256099942544/1712485313' },
      RewardedAd: { createForAdRequest: (unit: string, options: unknown) => {
        requests.push({ unit, options });
        return { load: () => listeners.get('rewarded_loaded')?.(), show: async () => { listeners.get('rewarded_earned_reward')?.(); listeners.get('closed')?.(); }, addAdEventListener: (type: string, listener: (...args: unknown[]) => void) => { listeners.set(type, listener); return () => listeners.delete(type); }, removeAllListeners: () => listeners.clear() };
      } }
    } : null });
    assert.ok(provider);
    configureNativeMonetizationProvider(provider);
    const premium = createRewardedResetSession({ platform: 'ios', premium: true });
    assert.equal(premium.status, 'fallback');
    assert.equal(requests.length, 0);
    const session = createRewardedResetSession({ platform: 'ios', premium: false });
    assert.equal(session.provider, 'native');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].unit, 'ca-app-pub-3940256099942544/1712485313');
    assert.deepEqual(requests[0].options, { requestNonPersonalizedAdsOnly: true, networkExtras: { ft_ctype: 'video_app_install' } });
    const result = await provider!.completeRewardedResetSession!(session, getMonetizationConfig({ platform: 'ios' }));
    assert.equal(result.rewardGranted, true);
    configure('production');
    const rejected = createRewardedResetSession({ platform: 'ios' });
    assert.equal(rejected.status, 'fallback');
    assert.equal(requests.length, 1);
  } finally { configureNativeMonetizationProvider(null); restore(); }
});
function restore() {
  configureNativeMonetizationBuild(null);
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
test('production sample settings never load the ads SDK, including an injected internal config marker', async () => {
  try {
    configure('production');
    const attempted: string[] = [];
    const config = { ...getMonetizationConfig({ platform: 'ios' }), buildChannel: 'internal-testflight' };
    const provider = await createNativeSdkMonetizationProvider({ platform: 'ios', config, loader: async name => { attempted.push(name); return null; } });
    assert.equal(provider, null);
    assert.equal(attempted.includes('react-native-google-mobile-ads'), false);
    assert.equal(isRewardedAdSdkConfigured({ ...config, allowTestAds: false, rewardedResetPlacementId: 'ca-app-pub-3940256099942544/1712485313' }), false);
    configure('internal-testflight');
    delete process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS;
    assert.equal(isRewardedAdSdkConfigured(getMonetizationConfig({ platform: 'ios' })), false);
    assert.equal(isRewardedAdSdkConfigured({ ...config, allowTestAds: true }), false);
  } finally { restore(); }
});
test('UMP denial skips SDK initialization and loading, and a close callback alone never grants a reward', async () => {
  try {
    configure('internal-testflight');
    for (const consent of [false, true]) {
      let loads = 0;
      let initializations = 0;
      const listeners = new Map<string, (...args: unknown[]) => void>();
      const provider = await createNativeSdkMonetizationProvider({ platform: 'ios', loader: async name => name === 'react-native-google-mobile-ads' ? {
        default: () => ({ initialize: async () => { initializations += 1; } }),
        AdsConsent: { gatherConsent: async () => ({ canRequestAds: consent }) },
        TestIds: { REWARDED: 'ca-app-pub-3940256099942544/1712485313' },
        RewardedAd: { createForAdRequest: () => ({ load: () => { loads += 1; listeners.get('rewarded_loaded')?.(); }, show: async () => { listeners.get('closed')?.(); }, addAdEventListener: (type: string, listener: (...args: unknown[]) => void) => { listeners.set(type, listener); return () => listeners.delete(type); }, removeAllListeners: () => listeners.clear() }) }
      } : null });
      assert.ok(provider);
      configureNativeMonetizationProvider(provider);
      const session = createRewardedResetSession({ platform: 'ios', premium: false });
      const result = await provider!.completeRewardedResetSession!(session, getMonetizationConfig({ platform: 'ios' }));
      assert.equal(loads, consent ? 1 : 0);
      assert.equal(initializations, consent ? 1 : 0);
      assert.equal(result.rewardGranted, false);
    }
  } finally { configureNativeMonetizationProvider(null); restore(); }
});
