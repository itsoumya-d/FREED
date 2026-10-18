const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, copyFileSync, symlinkSync, rmSync } = require('node:fs');
const { join, resolve, dirname } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const plist = require('@expo/plist').default;
const { compileModsAsync, withPlugins } = require('@expo/config-plugins');

function assertStartup(contents) {
  const registrations = [...contents.matchAll(/RNFBAppCheckModule\.sharedInstance\(\)/g)];
  const configurations = [...contents.matchAll(/FirebaseApp\.configure\(\)/g)];
  assert.equal(registrations.length, 1, 'Register the RNFirebase App Check factory once before Firebase starts.');
  assert.equal(configurations.length, 1, 'Configure the default Firebase app exactly once.');
  assert.ok(registrations[0].index < configurations[0].index, 'The factory must exist before default Firebase configuration.');
  assert.ok(configurations[0].index < contents.indexOf('factory.startReactNative('), 'Native Firebase setup must precede React Native startup.');
}

test('the actual Swift entrypoint registers App Check before default Firebase initialization', () => {
  assertStartup(readFileSync('ios/FREED/AppDelegate.swift', 'utf8'));
  const header = readFileSync('ios/FREED/FREED-Bridging-Header.h', 'utf8');
  assert.match(header, /#import\s+[<"]RNFBAppCheckModule\.h[>"]/);
});

test('the actual app signs App Attest for the Firebase-supported production environment', () => {
  const entitlements = plist.parse(readFileSync('ios/FREED/FREED.entitlements', 'utf8'));
  assert.equal(entitlements['com.apple.developer.devicecheck.appattest-environment'], 'production');
});

test('installed RNFB clean-template startup is repaired by actual Expo mods and remains idempotent', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'freed-app-check-mods-'));
  const template = resolve('node_modules/expo/template.tgz');
  const repairPlugin = resolve('plugins/with-freed-firebase-app-check.js');
  const plugins = ['@react-native-firebase/app', '@react-native-firebase/app-check', repairPlugin];
  try {
    for (const mode of ['template', 'current']) {
      const projectRoot = join(workspace, mode);
      const name = mode === 'template' ? 'HelloWorld' : 'FREED';
      mkdirSync(projectRoot, { recursive: true });
      const nativeDirectory = join(projectRoot, 'ios', name);
      if (mode === 'template') {
        execFileSync('tar', ['-xzf', template, '-C', projectRoot, '--strip-components=1', 'package/ios']);
      } else {
        for (const file of ['AppDelegate.swift', 'FREED-Bridging-Header.h', 'FREED.entitlements', 'Info.plist']) {
          mkdirSync(nativeDirectory, { recursive: true });
          copyFileSync(join('ios/FREED', file), join(nativeDirectory, file));
        }
        const projectFile = join(projectRoot, 'ios/FREED.xcodeproj/project.pbxproj');
        mkdirSync(dirname(projectFile), { recursive: true });
        copyFileSync('ios/FREED.xcodeproj/project.pbxproj', projectFile);
      }
      // Resolve installed plugins without creating or updating dependencies.
      symlinkSync(resolve('node_modules'), join(projectRoot, 'node_modules'), 'dir');
      const googleServicesFile = join(projectRoot, 'GoogleService-Info.plist');
      copyFileSync('ios/FREED/GoogleService-Info.plist', googleServicesFile);
      const appDelegate = join(nativeDirectory, 'AppDelegate.swift');
      const header = join(nativeDirectory, `${name}-Bridging-Header.h`);
      const entitlements = join(nativeDirectory, `${name}.entitlements`);
      const originalDelegate = readFileSync(appDelegate, 'utf8');
      const originalEntitlements = existsSync(entitlements) ? plist.parse(readFileSync(entitlements, 'utf8')) : {};
      if (mode === 'template') {
        const core = require(resolve('node_modules/@react-native-firebase/app/plugin/build/ios/appDelegate'));
        const appCheck = require(resolve('node_modules/@react-native-firebase/app-check/plugin/build/ios/appDelegate'));
        const broken = appCheck.modifySwiftAppDelegate(core.modifySwiftAppDelegate(originalDelegate));
        assert.equal((broken.match(/FirebaseApp\.configure\(\)/g) || []).length, 2,
          'Characterize the installed duplicate-init path that the repair must handle.');
      }
      const config = () => withPlugins({ name, slug: 'freed-app-check-fixture',
        _internal: { projectRoot },
        ios: { bundleIdentifier: 'app.freed.recovery', googleServicesFile } }, plugins);
      await compileModsAsync(config(), { projectRoot, platforms: ['ios'] });
      const firstDelegate = readFileSync(appDelegate, 'utf8');
      const firstHeader = readFileSync(header, 'utf8');
      const firstEntitlements = plist.parse(readFileSync(entitlements, 'utf8'));
      assertStartup(firstDelegate);
      assert.equal((firstHeader.match(/#import\s+[<"]RNFBAppCheckModule\.h[>"]/g) || []).length, 1);
      assert.equal(firstEntitlements['com.apple.developer.devicecheck.appattest-environment'], 'production');
      for (const [key, value] of Object.entries(originalEntitlements)) {
        if (key !== 'com.apple.developer.devicecheck.appattest-environment') assert.deepEqual(firstEntitlements[key], value);
      }
      if (mode === 'current') {
        const callbacks = originalDelegate.slice(originalDelegate.indexOf('  // Linking API'));
        assert.equal(firstDelegate.slice(firstDelegate.indexOf('  // Linking API')), callbacks,
          'Preserve Google/universal linking, Expo callbacks, and embedded QA bundle logic.');
      }
      await compileModsAsync(config(), { projectRoot, platforms: ['ios'] });
      assert.equal(readFileSync(appDelegate, 'utf8'), firstDelegate);
      assert.equal(readFileSync(header, 'utf8'), firstHeader);
      assert.deepEqual(plist.parse(readFileSync(entitlements, 'utf8')), firstEntitlements);
    }
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test('the saved app configuration registers the durable native startup plugins', () => {
  const factory = require('../app.config.js');
  const config = factory({ config: require('../app.json').expo });
  assert.ok(config.plugins.includes('@react-native-firebase/app'));
  assert.ok(config.plugins.includes('@react-native-firebase/app-check'));
  assert.ok(config.plugins.includes('./plugins/with-freed-firebase-app-check.js'));
});

test('the actual configured plugins survive an isolated Expo clean iOS prebuild without duplicate Firebase setup', () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'freed-app-check-prebuild-'));
  try {
    const factory = require('../app.config.js');
    const previousGoogleClient = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    let config;
    try {
      // Only the plugin-presence condition needs a public fixture value.
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'fixture-public-google-client';
      config = factory({ config: require('../app.json').expo });
    } finally {
      if (previousGoogleClient === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      else process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = previousGoogleClient;
    }
    config.plugins = config.plugins.map(item => Array.isArray(item)
      ? [item[0].startsWith('./') ? resolve(item[0]) : item[0], ...item.slice(1)]
      : item.startsWith('./') ? resolve(item) : item);
    // Public service files must be outside the generated directory for --clean.
    config.ios.googleServicesFile = './GoogleService-Info.plist';
    config.android.googleServicesFile = './google-services.json';
    copyFileSync('ios/FREED/GoogleService-Info.plist', join(projectRoot, 'GoogleService-Info.plist'));
    copyFileSync('android/app/google-services.json', join(projectRoot, 'google-services.json'));
    copyFileSync('package.json', join(projectRoot, 'package.json'));
    symlinkSync(resolve('node_modules'), join(projectRoot, 'node_modules'), 'dir');
    symlinkSync(resolve('assets'), join(projectRoot, 'assets'), 'dir');
    writeFileSync(join(projectRoot, 'app.json'), JSON.stringify({ expo: config }));
    execFileSync(process.execPath, [resolve('node_modules/expo/bin/cli'), 'prebuild', '--clean',
      '--platform', 'ios', '--no-install', '--template', resolve('node_modules/expo/template.tgz')], {
      cwd: projectRoot, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: '1', EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1' }
    });
    const nativeDirectory = join(projectRoot, 'ios/FREED');
    assertStartup(readFileSync(join(nativeDirectory, 'AppDelegate.swift'), 'utf8'));
    assert.equal((readFileSync(join(nativeDirectory, 'FREED-Bridging-Header.h'), 'utf8')
      .match(/#import\s+[<"]RNFBAppCheckModule\.h[>"]/g) || []).length, 1);
    const entitlements = plist.parse(readFileSync(join(nativeDirectory, 'FREED.entitlements'), 'utf8'));
    assert.equal(entitlements['com.apple.developer.devicecheck.appattest-environment'], 'production');
    const info = plist.parse(readFileSync(join(nativeDirectory, 'Info.plist'), 'utf8'));
    const service = plist.parse(readFileSync('ios/FREED/GoogleService-Info.plist', 'utf8'));
    assert.ok(info.CFBundleURLTypes.some(entry => entry.CFBundleURLSchemes.includes(service.REVERSED_CLIENT_ID)));
  } finally { rmSync(projectRoot, { recursive: true, force: true }); }
});
