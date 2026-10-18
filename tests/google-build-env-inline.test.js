const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const esbuild = require('esbuild');
const { expoInlineEnvVars } = require('babel-preset-expo/build/inline-env-vars');
const productionEnv = require('../eas.json').build.production.env;

test('actual Expo production transform preserves Google client IDs with an empty device environment', async () => {
  const configured = Object.fromEntries(Object.entries(productionEnv).filter(([key]) => key.startsWith('EXPO_PUBLIC_GOOGLE_')));
  const previous = Object.fromEntries(Object.keys(configured).map(key => [key, process.env[key]]));
  Object.assign(process.env, configured);
  try {
    for (const platform of ['ios', 'android']) {
      const result = await esbuild.build({ entryPoints: [path.resolve('src/lib/social-login.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', target: 'node20', supported: { 'dynamic-import': false }, logLevel: 'silent', external: ['react-native', 'expo-apple-authentication', 'expo-crypto', '@react-native-google-signin/google-signin'], plugins: [{ name: 'actual-expo-production-env-transform', setup(build) {
        build.onLoad({ filter: /\.tsx?$/ }, args => {
          const transformed = babel.transformSync(fs.readFileSync(args.path, 'utf8'), { filename: args.path, babelrc: false, configFile: false, parserOpts: { plugins: ['typescript', 'jsx'] }, plugins: [expoInlineEnvVars], caller: { name: 'metro', isDev: false, platform } });
          return { contents: transformed.code, loader: 'ts' };
        });
      } } ] });
      let sdkOptions;
      const context = { module: { exports: {} }, process: { env: {} }, __DEV__: false, require(name) {
        if (name === 'react-native') return { Platform: { OS: platform } };
        if (name === 'expo-apple-authentication') return { isAvailableAsync: async () => false };
        if (name === 'expo-crypto') return {};
        if (name === '@react-native-google-signin/google-signin') return { GoogleSignin: { configure: options => { sdkOptions = options; }, hasPlayServices: async () => true, signIn: async () => ({ type: 'success', data: { idToken: 'fixture-identity-token' } }) } };
        throw new Error(`Unexpected dependency: ${name}`);
      } };
      vm.runInNewContext(result.outputFiles[0].text, context);
      assert.equal(context.module.exports.isGoogleSignInConfigured(), true);
      assert.equal((await context.module.exports.signInWithGoogle()).ok, true);
      assert.equal(sdkOptions.webClientId, configured.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
      assert.equal(sdkOptions.iosClientId, platform === 'ios' ? configured.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID : undefined);
      assert.equal(sdkOptions.offlineAccess, false);
      assert.deepEqual(context.process.env, {});
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await esbuild.stop();
  }
});
