const IOS_SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
function iosAdMobBuildSetting(sdk, env = process.env) {
  const appId = String(env.EXPO_PUBLIC_ADMOB_APP_ID_IOS ?? env.EXPO_PUBLIC_ADMOB_APP_ID ?? '').trim();
  const real = /^ca-app-pub-\d{16}~\d{10}$/.test(appId) && !appId.startsWith('ca-app-pub-3940256099942544');
  if (real) return `GAD_APPLICATION_IDENTIFIER=${appId}`;
  if (String(sdk).startsWith('iphonesimulator')) return `GAD_APPLICATION_IDENTIFIER=${IOS_SAMPLE_APP_ID}`;
  throw new Error('A real EXPO_PUBLIC_ADMOB_APP_ID_IOS is required for an iOS device/archive build. Simulator sample IDs cannot be shipped.');
}
module.exports = { iosAdMobBuildSetting, IOS_SAMPLE_APP_ID };
