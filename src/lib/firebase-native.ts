import { Platform } from "react-native";
import { getApp } from "@react-native-firebase/app";
import {
  AppleAuthProvider,
  getAuth,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailLink
} from "@react-native-firebase/auth";
import { initializeAppCheck, ReactNativeFirebaseAppCheckProvider } from "@react-native-firebase/app-check";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { getInstallations, getId } from "@react-native-firebase/installations";
import { getMessaging, getToken, isDeviceRegisteredForRemoteMessages, registerDeviceForRemoteMessages } from "@react-native-firebase/messaging";
import crashlyticsModule from "@react-native-firebase/crashlytics";
import perfModule from "@react-native-firebase/perf";
import remoteConfigModule from "@react-native-firebase/remote-config";

import {
  createFirebaseAuthAdapter,
  createFirebaseCallableContracts,
  getFirebaseAppCheckProviderConfig,
  getFirebaseClientReadiness,
  getFirebaseEmailLinkReadiness,
  getFirebaseMessagingRegistrationContract,
  type FirebaseAuthNativeApi,
  type FirebaseCallableResult,
  type FirebaseMessagingRegistration
} from "@/lib/firebase-client";

export type FirebaseStartupResult = {
  status: "started" | "unconfigured" | "unsupported" | "error";
  reason?: string;
};

export type FirebaseBackendReadinessCallableResult = {
  ok: boolean;
  acceptsRecoveryContent: false;
  projectRegion: "asia-south1";
  appCheckRequired: true;
};

let startupPromise: Promise<FirebaseStartupResult> | null = null;
let appCheckPromise: Promise<void> | null = null;
let functionsEmulatorConnected = false;

/**
 * Native-only service initialization. It deliberately does not write Firestore
 * or Storage, attach a Firebase UID to crash reports, or log recovery content.
 */
export function startFirebaseClient(): Promise<FirebaseStartupResult> {
  if (!startupPromise) startupPromise = initializeFirebaseClient();
  return startupPromise;
}

export function getFirebaseNativeAuthAdapter() {
  const emailLinkReadiness = getFirebaseEmailLinkReadiness();
  return createFirebaseAuthAdapter(firebaseAuthNativeApi(), {
    emailLinkReady: emailLinkReadiness.ready,
    emailLinkDomain: emailLinkReadiness.linkDomain ?? undefined
  });
}

export async function getFirebaseMessagingRegistrationAfterPermission(
  notificationsAuthorized: boolean
): Promise<FirebaseMessagingRegistration | null> {
  if (!notificationsAuthorized || Platform.OS === "web") return null;

  const app = getApp();
  const messaging = getMessaging(app);
  if (!isDeviceRegisteredForRemoteMessages(messaging)) {
    await registerDeviceForRemoteMessages(messaging);
  }

  const [installationId, token] = await Promise.all([
    getId(getInstallations(app)),
    getToken(messaging)
  ]);
  return getFirebaseMessagingRegistrationContract({ installationId, token });
}

/**
 * Calls the deployed Auth + App Check protected readiness endpoint only after
 * native App Check initialization. Authentication/App Check errors propagate
 * rather than being converted into a less-protected fallback request.
 */
export async function callFirebaseBackendReadiness(): Promise<FirebaseBackendReadinessCallableResult | null> {
  const readiness = getFirebaseClientReadiness();
  if (!readiness.ready || Platform.OS === "web" || !readiness.functionsRegion) return null;
  const startup = await startFirebaseClient();
  if (startup.status !== "started") return null;

  const callable = httpsCallable<undefined, FirebaseBackendReadinessCallableResult>(
    getConfiguredFunctions(),
    "backendReadiness"
  );
  const result = await callable(undefined);
  return result.data;
}

/**
 * Callable transport is native-only and region-pinned. Consumers receive the
 * allowlisted contracts from firebase-client rather than raw callable access.
 */
export function getFirebaseCallableContracts() {
  const readiness = getFirebaseClientReadiness();
  if (!readiness.ready || Platform.OS === "web") return null;
  const functions = getConfiguredFunctions();
  return createFirebaseCallableContracts({
    async call(name, data): Promise<FirebaseCallableResult> {
      const callable = httpsCallable<unknown, FirebaseCallableResult>(functions, name);
      return (await callable(data)).data;
    }
  });
}

async function initializeFirebaseClient(): Promise<FirebaseStartupResult> {
  const readiness = getFirebaseClientReadiness();
  if (!readiness.ready) {
    return { status: "unconfigured", reason: readiness.missing[0] ?? "Firebase is not configured." };
  }
  if (Platform.OS === "web") {
    return { status: "unsupported", reason: "Firebase native modules require an iOS or Android custom build." };
  }

  try {
    await initializeFirebaseAppCheck();
    const crashlytics = crashlyticsModule();
    const performance = perfModule();
    const remoteConfig = remoteConfigModule();

    // No user ID, custom attributes, or user-entered recovery text is attached.
    await Promise.allSettled([
      crashlytics.setCrashlyticsCollectionEnabled(false),
      performance.setPerformanceCollectionEnabled(false),
      remoteConfig.setConfigSettings({
        minimumFetchIntervalMillis: 12 * 60 * 60 * 1000
      }),
      remoteConfig.setDefaults({
        firebase_foundation_enabled: false,
        app_check_enforcement_enabled: false
      })
    ]);
    void remoteConfig.fetchAndActivate().catch(() => undefined);
    getConfiguredFunctions();

    return { status: "started" };
  } catch {
    return { status: "error", reason: "Firebase native startup could not complete." };
  }
}

function initializeFirebaseAppCheck() {
  if (!appCheckPromise) {
    const readiness = getFirebaseClientReadiness();
    const android = getFirebaseAppCheckProviderConfig("android", readiness);
    const apple = getFirebaseAppCheckProviderConfig("ios", readiness);
    const androidProvider = android.provider === "debug" ? "debug" : "playIntegrity";
    const appleProvider = apple.provider === "debug" ? "debug" : "appAttestWithDeviceCheckFallback";
    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: androidProvider,
        ...(android.debugToken ? { debugToken: android.debugToken } : {})
      },
      apple: {
        provider: appleProvider,
        ...(apple.debugToken ? { debugToken: apple.debugToken } : {})
      }
    });
    appCheckPromise = initializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true
    }).then(() => undefined);
  }
  return appCheckPromise;
}

function getConfiguredFunctions() {
  const readiness = getFirebaseClientReadiness();
  const functions = getFunctions(getApp(), readiness.functionsRegion ?? "asia-south1");
  const useEmulators = process.env.EXPO_PUBLIC_FIREBASE_USE_EMULATORS === "true";
  if (useEmulators && readiness.environment !== "production" && !functionsEmulatorConnected) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    functionsEmulatorConnected = true;
  }
  return functions;
}

function firebaseAuthNativeApi(): FirebaseAuthNativeApi {
  const nativeAuth = getAuth(getApp());
  return {
    sendSignInLinkToEmail: (email, settings) => sendSignInLinkToEmail(nativeAuth, email, settings),
    isSignInWithEmailLink: (link) => isSignInWithEmailLink(nativeAuth, link),
    signInWithEmailLink: (email, link) => signInWithEmailLink(nativeAuth, email, link),
    createGoogleCredential: (idToken, accessToken) => GoogleAuthProvider.credential(idToken, accessToken),
    createAppleCredential: (identityToken, nonce) => AppleAuthProvider.credential(identityToken, nonce),
    signInWithCredential: (credential) => signInWithCredential(nativeAuth, credential as never),
    currentUser: () => nativeAuth.currentUser
  };
}
