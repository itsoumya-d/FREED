const assert = require('node:assert/strict');
const { iosAdMobBuildSetting, IOS_SAMPLE_APP_ID } = require('../scripts/lib/ios-admob-build-config');
assert.equal(iosAdMobBuildSetting('iphonesimulator', {}), `GAD_APPLICATION_IDENTIFIER=${IOS_SAMPLE_APP_ID}`);
assert.throws(() => iosAdMobBuildSetting('iphoneos', {}), /real.*required/);
assert.throws(() => iosAdMobBuildSetting('iphoneos', {EXPO_PUBLIC_ADMOB_APP_ID_IOS:IOS_SAMPLE_APP_ID}), /cannot be shipped/);
assert.equal(iosAdMobBuildSetting('iphoneos', {EXPO_PUBLIC_ADMOB_APP_ID_IOS:'ca-app-pub-1234567890123456~1234567890'}), 'GAD_APPLICATION_IDENTIFIER=ca-app-pub-1234567890123456~1234567890');
console.log('PASS: AdMob app ID is supplied and sample IDs stay confined to Simulator');
