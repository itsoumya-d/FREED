const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const esbuild = require('esbuild');
const { expoInlineEnvVars } = require('babel-preset-expo/build/inline-env-vars');

test('optimized native bundles retain configured product identifiers and provider without a runtime environment', async () => {
  // Public configuration fixtures, never store prices or credentials used for checkout.
  const configured = {
    EXPO_PUBLIC_IAP_PRODUCT_YEARLY: 'app.freed.fixture.yearly',
    EXPO_PUBLIC_IAP_PRODUCT_MONTHLY: 'app.freed.fixture.monthly',
    EXPO_PUBLIC_STORE_PROVIDER: 'revenuecat',
    EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID: 'fixture-premium',
    EXPO_PUBLIC_REVENUECAT_API_KEY_IOS: 'public-fixture-api-key',
    EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY_IOS: 'IN',
    EXPO_PUBLIC_BUILD_CHANNEL: 'internal-testflight',
    EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true',
    EXPO_PUBLIC_ADMOB_APP_ID_IOS: 'ca-app-pub-1234567890123456~1234567890'
  };
  const previous = Object.fromEntries(Object.keys(configured).map(key => [key, process.env[key]]));
  Object.assign(process.env, configured);
  try {
    const result = await esbuild.build({
      entryPoints: [path.resolve('src/lib/monetization.ts')], bundle: true, write: false,
      platform: 'node', format: 'cjs', target: 'node20', logLevel: 'silent',
      plugins: [{ name: 'actual-expo-production-env-transform', setup(build) {
        build.onLoad({ filter: /\.tsx?$/ }, args => {
          const transformed = babel.transformSync(fs.readFileSync(args.path, 'utf8'), {
            filename: args.path, babelrc: false, configFile: false,
            parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [expoInlineEnvVars],
            caller: { name: 'metro', isDev: false, platform: 'ios' }
          });
          return { contents: transformed.code, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
        });
      } }]
    });
    const context = { module: { exports: {} }, process: { env: {} }, __DEV__: false };
    vm.runInNewContext(result.outputFiles[0].text, context);
    context.module.exports.configureNativeMonetizationBuild(false);
    const config = context.module.exports.getMonetizationConfig({ platform: 'ios', mode: 'native' });
    assert.equal(config.launchProductIds.yearly, configured.EXPO_PUBLIC_IAP_PRODUCT_YEARLY);
    assert.equal(config.launchProductIds.monthly, configured.EXPO_PUBLIC_IAP_PRODUCT_MONTHLY);
    assert.equal(config.storeProvider, configured.EXPO_PUBLIC_STORE_PROVIDER);
    assert.equal(config.revenueCatEntitlementId, configured.EXPO_PUBLIC_PREMIUM_ENTITLEMENT_ID);
    assert.equal(config.revenueCatApiKey, configured.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS);
    assert.equal(config.adRequestCountryCode, configured.EXPO_PUBLIC_ADMOB_REQUEST_COUNTRY_IOS);
    assert.equal(config.buildChannel, configured.EXPO_PUBLIC_BUILD_CHANNEL);
    assert.equal(config.allowTestAds, true);
    assert.equal(context.module.exports.isRewardedAdSdkConfigured(config), true);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await esbuild.stop();
  }
});
