// Run the installed SDK JS unchanged; only the React Native bridge/emitter is simulated.
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const platformArg = process.argv.find(arg => arg.startsWith('--fixture-platform='));
const platform = platformArg?.split('=')[1];
const { EventEmitter } = require('node:events');
const events = new EventEmitter();
global.__rewardedNativeFixture = { events, scenario: {} };
class RNEmitter {
  constructor() { this.events = new EventEmitter(); }
  addListener(name, callback) { this.events.on(name, callback); return { remove: () => this.events.off(name, callback) }; }
  emit(name, value) { this.events.emit(name, value); }
  removeAllListeners(name) { this.events.removeAllListeners(name); }
}
class NativeEmitter extends RNEmitter { constructor() { super(); this.events = events; } }
const fixture = global.__rewardedNativeFixture;
const bridge = {
  RNAppModule: { eventsNotifyReady() {}, eventsAddListener() {}, eventsRemoveListener() {} },
  RNGoogleMobileAdsConsentModule: {
    requestInfoUpdate: () => fixture.scenario.update(),
    loadAndShowConsentFormIfRequired: () => fixture.scenario.form(),
    getConsentInfo: () => fixture.scenario.info(),
    showPrivacyOptionsForm: () => fixture.scenario.privacy(),
  },
  RNGoogleMobileAdsModule: { initialize: () => fixture.scenario.init() },
  RNGoogleMobileAdsRewardedModule: {
    rewardedLoad: (...args) => fixture.scenario.load(...args),
    rewardedShow: (...args) => fixture.scenario.show(...args),
  },
};
global.__rewardedRN = { NativeEventEmitter: NativeEmitter, TurboModuleRegistry: { getEnforcing(name) { if (!bridge[name]) throw Error(`Unexpected bridge ${name}`); return bridge[name]; } }, Platform: { OS: platform, select(options) { return options[this.OS] ?? options.default; } }, Emitter: RNEmitter };
async function runInstalledSdk() {
  assert.ok(platform === 'ios' || platform === 'android');
  const built = await esbuild.build({ entryPoints: ['tests/fixtures/rewarded-installed-sdk.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', plugins: [{ name: 'native-bridge-only', setup(build) {
    build.onResolve({ filter: /^react-native(?:\/|$)/ }, args => ({ path: args.path, namespace: 'rn-fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'rn-fixture' }, args => ({ contents: args.path.includes('EventEmitter') ? 'export default globalThis.__rewardedRN.Emitter;' : 'export const {NativeEventEmitter,TurboModuleRegistry,Platform}=globalThis.__rewardedRN;' }));
  } }] });
  const filename = path.resolve('tests/fixtures/rewarded-installed-sdk.ts');
  const entry = new Module(filename, module); entry.filename = filename; entry.paths = Module._nodeModulePaths(path.dirname(filename));
  entry._compile(built.outputFiles[0].text, filename);
  await esbuild.stop();
}
if (platformArg) {
  runInstalledSdk().catch(error => { console.error(error); process.exitCode = 1; });
} else {
  for (const testedPlatform of ['ios', 'android']) {
    test(`installed SDK forwards the Google test-video request and preserves reward fences on ${testedPlatform}`, () => {
      const child = spawnSync(process.execPath, [__filename, `--fixture-platform=${testedPlatform}`], { encoding: 'utf8', timeout: 60000 });
      assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
      const receipts = child.stdout.trim().split('\n').map(line => JSON.parse(line));
      assert.equal(receipts.length, 18);
      assert.ok(receipts.every(receipt => receipt.platform === testedPlatform));
      console.log(child.stdout.trim());
    });
  }
}
