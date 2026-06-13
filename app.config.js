function readEnv(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function readPlatformEnv(baseName, platform) {
  return readEnv(`${baseName}_${platform}`) ?? readEnv(baseName);
}

function isValidAdMobAppId(value) {
  return (
    typeof value === "string" &&
    /^ca-app-pub-\d{16}~\d{10}$/.test(value) &&
    !value.includes("ca-app-pub-3940256099942544")
  );
}

module.exports = ({ config }) => {
  const iosAdMobAppId = readPlatformEnv("EXPO_PUBLIC_ADMOB_APP_ID", "IOS");
  const androidAdMobAppId = readPlatformEnv("EXPO_PUBLIC_ADMOB_APP_ID", "ANDROID");
  const easProjectId = readEnv("EAS_PROJECT_ID") ?? readEnv("EXPO_PROJECT_ID");
  const expoOwner = readEnv("EXPO_OWNER");
  const plugins = [...(config.plugins ?? [])];

  if (isValidAdMobAppId(iosAdMobAppId) && isValidAdMobAppId(androidAdMobAppId)) {
    plugins.push([
      "react-native-google-mobile-ads",
      {
        iosAppId: iosAdMobAppId,
        androidAppId: androidAdMobAppId,
        delayAppMeasurementInit: true,
        optimizeInitialization: true,
        optimizeAdLoading: true
      }
    ]);
  }

  const nextConfig = {
    ...config,
    plugins
  };

  if (expoOwner) {
    nextConfig.owner = expoOwner;
  }

  if (easProjectId) {
    const existingExtra = config.extra && typeof config.extra === "object" ? config.extra : {};
    const existingEas = existingExtra.eas && typeof existingExtra.eas === "object" ? existingExtra.eas : {};
    nextConfig.extra = {
      ...existingExtra,
      eas: {
        ...existingEas,
        projectId: easProjectId
      }
    };
  }

  return nextConfig;
};
