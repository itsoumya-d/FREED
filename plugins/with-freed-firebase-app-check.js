const { withAppDelegate, withEntitlementsPlist } = require('@expo/config-plugins');
const { readFileSync, writeFileSync } = require('node:fs');
const { dirname, basename, join } = require('node:path');

const APP_ATTEST_ENVIRONMENT = 'com.apple.developer.devicecheck.appattest-environment';
const STARTUP_TAG = 'freed-app-check-startup';

function removeGeneratedBlock(contents, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return contents.replace(new RegExp(
    `^[\\t ]*// @generated begin ${escaped}[^\\n]*\\n[\\s\\S]*?^[\\t ]*// @generated end ${escaped}[^\\n]*(?:\\n|$)`, 'gm'
  ), '');
}

function normalizeSwiftStartup(contents) {
  let result = contents;
  // RNFB 25.1's App Check plugin can append a second configure call after the
  // app plugin's generated block. Replace only these default-app startup hooks.
  for (const tag of [STARTUP_TAG, '@react-native-firebase/app-didFinishLaunchingWithOptions', '@react-native-firebase/app-check']) {
    result = removeGeneratedBlock(result, tag);
  }
  result = result.replace(/^[\t ]*if FirebaseApp\.app\(\) == nil \{ FirebaseApp\.configure\(\) \}[\t ]*\r?\n/gm, '');
  result = result.replace(/^[\t ]*(?:RNFBAppCheckModule\.sharedInstance\(\)|FirebaseApp\.configure\(\))[\t ]*\r?\n/gm, '');
  result = result.replace(/^import RNFBAppCheck\r?\n/gm, '');
  if (!result.includes('import FirebaseCore')) {
    result = result.replace(/^((?:internal )?import Expo)[\t ]*$/m, '$1\nimport FirebaseCore');
  }
  const launch = /didFinishLaunchingWithOptions[\s\S]*?\)\s*->\s*Bool\s*\{/;
  if (!launch.test(result)) throw new Error('FREED App Check requires a Swift didFinishLaunchingWithOptions entrypoint.');
  const startup = [
    `    // @generated begin ${STARTUP_TAG}`,
    '    RNFBAppCheckModule.sharedInstance()',
    '    if FirebaseApp.app() == nil { FirebaseApp.configure() }',
    `    // @generated end ${STARTUP_TAG}`
  ].join('\n');
  result = result.replace(launch, match => `${match}\n${startup}`);
  if ((result.match(/FirebaseApp\.configure\(\)/g) || []).length !== 1 ||
      (result.match(/RNFBAppCheckModule\.sharedInstance\(\)/g) || []).length !== 1) {
    throw new Error('FREED App Check could not establish one ordered default Firebase startup.');
  }
  return result;
}

module.exports = function withFreedFirebaseAppCheck(config) {
  config = withEntitlementsPlist(config, config => {
    // Firebase rejects App Attest sandbox tokens, including development builds.
    config.modResults[APP_ATTEST_ENVIRONMENT] = 'production';
    return config;
  });
  // Expo runs AppDelegate mods after the RNFB dangerous mods. This repairs the
  // clean template as well as preserving the existing custom delegate callbacks.
  return withAppDelegate(config, config => {
    if (config.modResults.language !== 'swift') throw new Error('FREED App Check requires the Swift Expo AppDelegate.');
    config.modResults.contents = normalizeSwiftStartup(config.modResults.contents);
    const directory = dirname(config.modResults.path);
    const headerPath = join(directory, `${basename(directory)}-Bridging-Header.h`);
    const header = readFileSync(headerPath, 'utf8');
    const declaration = '#import <RNFBAppCheckModule.h>';
    if (!/#import\s+[<"]RNFBAppCheckModule\.h[>"]/.test(header)) {
      writeFileSync(headerPath, `${header.trimEnd()}\n\n${declaration}\n`);
    }
    return config;
  });
};
