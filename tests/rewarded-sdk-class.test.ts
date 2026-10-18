import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configureNativeMonetizationBuild, getMonetizationConfig } from '../src/lib/monetization';
import { createNativeSdkMonetizationProvider } from '../src/lib/native-monetization-runtime';

// The installed Invertase SDK exports RewardedAd as a class with a static factory,
// not the plain-object factory used by the older adapter fixtures.
test('SDK class exports deliver only witnessed rewards on iOS and Android', async () => {
  const keys = ['NODE_ENV', 'EXPO_PUBLIC_BUILD_CHANNEL', 'EXPO_PUBLIC_MONETIZATION_MODE',
    'EXPO_PUBLIC_ADMOB_USE_TEST_ADS', 'EXPO_PUBLIC_ADMOB_APP_ID_IOS', 'EXPO_PUBLIC_ADMOB_APP_ID_ANDROID'];
  const previous = keys.map(key => [key, process.env[key]] as const);
  try {
    configureNativeMonetizationBuild(false);
    Object.assign(process.env, { NODE_ENV: 'production', EXPO_PUBLIC_BUILD_CHANNEL: 'internal-testflight',
      EXPO_PUBLIC_MONETIZATION_MODE: 'native', EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true',
      EXPO_PUBLIC_ADMOB_APP_ID_IOS: 'ca-app-pub-1234567890123456~1234567890',
      EXPO_PUBLIC_ADMOB_APP_ID_ANDROID: 'ca-app-pub-1234567890123456~1234567890' });
    for (const platform of ['ios', 'android'] as const) {
      for (const outcome of ['earned', 'skipped', 'error'] as const) {
        const listeners = new Map<string, () => void>();
        const requests: Array<{ unit: string; options: unknown }> = [];
        let initialized = 0, presented = 0, dismissed = 0;
        class SDKRewardedAd {
          static createForAdRequest(unit: string, options: unknown) {
            requests.push({ unit, options });
            return {
              load: () => listeners.get('rewarded_loaded')?.(),
              show: async () => {
                assert.equal(initialized, 1);
                if (outcome === 'earned') listeners.get('rewarded_earned_reward')?.();
                listeners.get(outcome === 'error' ? 'error' : 'closed')?.();
              },
              addAdEventListener: (type: string, listener: () => void) => {
                listeners.set(type, listener); return () => { listeners.delete(type); };
              },
              removeAllListeners: () => { listeners.clear(); },
            };
          }
        }
        const unit = platform === 'ios' ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917';
        const provider = await createNativeSdkMonetizationProvider({ platform,
          loader: async name => name === 'react-native-google-mobile-ads' ? {
            RewardedAd: SDKRewardedAd, TestIds: { REWARDED: unit },
            AdsConsent: { gatherConsent: async () => ({ canRequestAds: true }) },
            default: () => ({ initialize: async () => { initialized++; } }),
          } : null });
        assert.ok(provider, 'a real SDK class export must create the native adapter');
        const config = getMonetizationConfig({ platform });
        const session = provider.createRewardedResetSession!(config);
        assert.ok(session); assert.equal(session.provider, 'native');
        assert.deepEqual(requests, [{ unit, options: { requestNonPersonalizedAdsOnly: true, networkExtras: { ft_ctype: 'video_app_install' } } }]);
        const result = await provider.completeRewardedResetSession!(session, config, () => true, {
          onPresenting: () => { presented++; }, onDismissed: () => { dismissed++; },
        });
        assert.equal(result.rewardGranted, outcome === 'earned');
        assert.equal(result.status, outcome === 'earned' ? 'completed' : 'failed');
        assert.equal(presented, 1); assert.equal(dismissed, 1);
        assert.equal(listeners.size, 0, 'all SDK listeners must be removed after the attempt');
      }
    }
  } finally {
    configureNativeMonetizationBuild(null);
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
