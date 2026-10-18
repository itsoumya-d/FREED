const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const esbuild = require('esbuild');
const { expoInlineEnvVars } = require('babel-preset-expo/build/inline-env-vars');

test('the actual Expo production transform retains public client config in an empty device environment', () => {
  const fixture = { EXPO_PUBLIC_IAP_PRODUCT_YEARLY: 'fixture_yearly', EXPO_PUBLIC_IAP_PRODUCT_MONTHLY: 'fixture_monthly', EXPO_PUBLIC_ADMOB_APP_ID_IOS: 'fixture_ios_id', EXPO_PUBLIC_FIREBASE_ENV: 'production', OPENAI_API_KEY: 'server_secret_must_never_inline', EXPO_PUBLIC_OPENAI_API_KEY: 'forbidden_public_secret_must_never_inline' };
  const previous = Object.fromEntries(Object.keys(fixture).map(key => [key, process.env[key]]));
  Object.assign(process.env, fixture);
  try {
    const transformed = babel.transformSync(fs.readFileSync('src/lib/public-client-env.ts', 'utf8'), { filename: 'src/lib/public-client-env.ts', configFile: false, babelrc: false, caller: { name: 'metro', isDev: false }, plugins: [expoInlineEnvVars, '@babel/plugin-transform-typescript'] });
    const code = esbuild.transformSync(transformed.code, { format: 'cjs', platform: 'node' }).code;
    const context = { module: { exports: {} }, process: { env: {} } };
    vm.runInNewContext(code, context);
    const api = context.module.exports;
    assert.equal(api.readClientEnvironmentValue('EXPO_PUBLIC_IAP_PRODUCT_YEARLY'), 'fixture_yearly');
    assert.equal(api.readClientEnvironmentValue('EXPO_PUBLIC_IAP_PRODUCT_MONTHLY'), 'fixture_monthly');
    assert.equal(api.readClientEnvironmentValue('EXPO_PUBLIC_ADMOB_APP_ID_IOS'), 'fixture_ios_id');
    assert.equal(api.getPublicClientEnvironment().EXPO_PUBLIC_FIREBASE_ENV, 'production');
    assert.equal(api.readClientEnvironmentValue('EXPO_PUBLIC_OPENAI_API_KEY'), undefined);
    assert.doesNotMatch(code, /server_secret_must_never_inline|forbidden_public_secret_must_never_inline/);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    esbuild.stop();
  }
});
