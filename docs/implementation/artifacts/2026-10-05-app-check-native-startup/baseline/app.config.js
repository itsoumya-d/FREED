const { nativePublicBuildConfig } = require("./scripts/lib/native-public-build-config");

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

function readFirebaseEnvironment() {
  const value = readEnv("EXPO_PUBLIC_FIREBASE_ENV") ?? "production";
  if (value !== "production" && value !== "staging") {
    throw new Error("EXPO_PUBLIC_FIREBASE_ENV must be either production or staging.");
  }
  if (value === "staging") {
    throw new Error(
      "Firebase staging is blocked: freed-staging-7d5ee is not provisioned after Google project-quota code 8. Do not use production Google service files for staging."
    );
  }
  return value;
}

module.exports = ({ config }) => {
  const build = nativePublicBuildConfig(process.env, __dirname);
  const iosAdMobAppId = readPlatformEnv("EXPO_PUBLIC_ADMOB_APP_ID", "IOS");
  const androidAdMobAppId = readPlatformEnv("EXPO_PUBLIC_ADMOB_APP_ID", "ANDROID");
  const easProjectId = readEnv("EAS_PROJECT_ID") ?? readEnv("EXPO_PROJECT_ID");
  const expoOwner = readEnv("EXPO_OWNER");
  const firebaseEnvironment = readFirebaseEnvironment();
  const plugins = [...(config.plugins ?? [])];
  plugins.push(['expo-localization', { supportedLocales: { ios: ['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'], android: ['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'] } }]);
  plugins.push(['./modules/freed-protection/app.plugin.js', { releaseEnabled: build.encryptedDnsReleaseEnabled, devPreview: process.env.FREED_ENCRYPTED_DNS_DEV_PREVIEW === 'true', focusShieldReleaseEnabled: false, focusShieldDevPreview: process.env.FREED_FOCUS_SHIELD_DEV_PREVIEW === 'true' }]);

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

  const googleWebClientId = readEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");

  if (googleWebClientId) {
    // No options object: derive native Google configuration from Firebase files.
    plugins.push("@react-native-google-signin/google-signin");
  }

  const nextConfig = {
    ...config,
    plugins,
    ios: {
      ...config.ios,
      usesAppleSignIn: true,
      // iOS backup encryption uses Apple CommonCrypto/CryptoKit; network
      // encryption uses platform TLS. Reassess if non-platform crypto is added.
      infoPlist: { ...config.ios?.infoPlist, ITSAppUsesNonExemptEncryption: false },
      googleServicesFile: "./ios/FREED/GoogleService-Info.plist"
    },
    android: {
      ...config.android,
      googleServicesFile: "./android/app/google-services.json"
    }
  };

  if (expoOwner) {
    nextConfig.owner = expoOwner;
  }

  if (easProjectId) {
    const existingExtra = config.extra && typeof config.extra === "object" ? config.extra : {};
    const existingEas = existingExtra.eas && typeof existingExtra.eas === "object" ? existingExtra.eas : {};
    nextConfig.extra = {
      ...existingExtra,
      build: { channel: build.channel, internalTestflight: build.internalTestflight },
      firebase: {
        environment: firebaseEnvironment,
        projectId: "freed-7d5ee",
        functionsRegion: "asia-south1"
      },
      eas: {
        ...existingEas,
        projectId: easProjectId
      }
    };
  } else {
    const existingExtra = config.extra && typeof config.extra === "object" ? config.extra : {};
    nextConfig.extra = {
      ...existingExtra,
      build: { channel: build.channel, internalTestflight: build.internalTestflight },
      firebase: {
        environment: firebaseEnvironment,
        projectId: "freed-7d5ee",
        functionsRegion: "asia-south1"
      }
    };
  }

  return nextConfig;
};
