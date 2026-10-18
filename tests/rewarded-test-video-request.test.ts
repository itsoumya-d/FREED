import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configureNativeMonetizationBuild, getMonetizationConfig, type MonetizationPlatform } from '../src/lib/monetization';
import { createNativeSdkMonetizationProvider } from '../src/lib/native-monetization-runtime';

const envKeys = ['NODE_ENV', 'EXPO_PUBLIC_BUILD_CHANNEL', 'EXPO_PUBLIC_MONETIZATION_MODE',
  'EXPO_PUBLIC_ADMOB_USE_TEST_ADS', 'EXPO_PUBLIC_ADMOB_APP_ID_IOS', 'EXPO_PUBLIC_ADMOB_APP_ID_ANDROID'];
const samples = {
  ios: 'ca-app-pub-3940256099942544/1712485313',
  android: 'ca-app-pub-3940256099942544/5224354917',
};

async function withInternalBuild(run: () => Promise<void>) {
  const previous = envKeys.map(key => [key, process.env[key]] as const);
  try {
    configureNativeMonetizationBuild(false);
    Object.assign(process.env, { NODE_ENV: 'production', EXPO_PUBLIC_BUILD_CHANNEL: 'internal-testflight',
      EXPO_PUBLIC_MONETIZATION_MODE: 'native', EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true',
      EXPO_PUBLIC_ADMOB_APP_ID_IOS: 'ca-app-pub-1234567890123456~1234567890',
      EXPO_PUBLIC_ADMOB_APP_ID_ANDROID: 'ca-app-pub-1234567890123456~1234567890' });
    await run();
  } finally {
    configureNativeMonetizationBuild(null);
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

// Only the unavailable native factory is doubled. Requests come from the actual
// production runtime/adapter; the separate installed-SDK fixture validates them
// through Invertase's unchanged request validation and event implementation.
function nativeModule(platform: 'ios' | 'android', requests: Array<{ unit: string; options: unknown }>, exposeTestUnit = true) {
  class RewardedAd {
    static createForAdRequest(unit: string, options: unknown) {
      requests.push({ unit, options });
      return { load() {}, show: async () => {}, addAdEventListener: () => () => {}, removeAllListeners() {} };
    }
  }
  return { RewardedAd, TestIds: exposeTestUnit ? { REWARDED: samples[platform] } : {} };
}

for (const platform of ['ios', 'android'] as const) {
  test(`internal ${platform} requests a Google sample video without private targeting`, async () => withInternalBuild(async () => {
    const requests: Array<{ unit: string; options: unknown }> = [];
    const config = getMonetizationConfig({ platform });
    const provider = await createNativeSdkMonetizationProvider({ platform, config,
      loader: async name => name === 'react-native-google-mobile-ads' ? nativeModule(platform, requests) : null });
    assert.ok(provider?.createRewardedResetSession?.(config));
    assert.deepEqual(requests, [{ unit: samples[platform], options: {
      requestNonPersonalizedAdsOnly: true, networkExtras: { ft_ctype: 'video_app_install' },
    } }]);
  }));

  test(`cached ${platform} test adapter cannot carry video extras into production requests`, async () => withInternalBuild(async () => {
    const requests: Array<{ unit: string; options: unknown }> = [];
    const testConfig = getMonetizationConfig({ platform });
    const provider = await createNativeSdkMonetizationProvider({ platform, config: testConfig,
      loader: async name => name === 'react-native-google-mobile-ads' ? nativeModule(platform, requests) : null });
    assert.ok(provider?.createRewardedResetSession?.(testConfig));
    process.env.EXPO_PUBLIC_BUILD_CHANNEL = 'production';
    assert.equal(provider!.createRewardedResetSession!(testConfig), null, 'a cached test configuration must fail the current production guard');
    assert.equal(requests.length, 1);
    process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS = 'false';
    const productionConfig = { ...getMonetizationConfig({ platform }), rewardedResetPlacementId: 'ca-app-pub-1234567890123456/1234567890' };
    assert.ok(provider!.createRewardedResetSession!(productionConfig));
    assert.deepEqual(requests[1], { unit: 'ca-app-pub-1234567890123456/1234567890', options: { requestNonPersonalizedAdsOnly: true } });
    process.env.EXPO_PUBLIC_BUILD_CHANNEL = 'internal-testflight';
    assert.equal(provider!.createRewardedResetSession!(testConfig), null, 'turning off test mode must also invalidate cached test configuration');
    assert.equal(requests.length, 2);
    assert.ok(provider!.createRewardedResetSession!({ ...productionConfig, buildChannel: 'internal-testflight' }));
    assert.deepEqual(requests[2], { unit: 'ca-app-pub-1234567890123456/1234567890', options: { requestNonPersonalizedAdsOnly: true } });
  }));
}

test('invalid configuration and unavailable native SDK never emit a video request', async () => withInternalBuild(async () => {
  for (const platform of ['ios', 'android'] as const) {
    const requests: Array<{ unit: string; options: unknown }> = [];
    const config = getMonetizationConfig({ platform });
    for (const invalid of [
      { ...config, admobAppId: null },
      { ...config, mode: 'mock' as const },
      { ...config, platform: 'web' as MonetizationPlatform },
    ]) {
      const imported: string[] = [];
      assert.equal(await createNativeSdkMonetizationProvider({ platform: invalid.platform, config: invalid,
        loader: async name => { imported.push(name); return name === 'react-native-google-mobile-ads' ? nativeModule(platform, requests) : null; } }), null);
      assert.ok(!imported.includes('react-native-google-mobile-ads'));
    }
    assert.equal(await createNativeSdkMonetizationProvider({ platform, config, loader: async () => { throw Error('native unavailable'); } }), null);
    const missingTestUnit = await createNativeSdkMonetizationProvider({ platform, config,
      loader: async name => name === 'react-native-google-mobile-ads' ? nativeModule(platform, requests, false) : null });
    assert.ok(missingTestUnit);
    assert.equal(missingTestUnit.createRewardedResetSession!(config), null);
    assert.deepEqual(requests, []);
  }
}));
